import { actividadLabel, destinoLabel, type TrabajoExtraordinario } from '../types/trabajosExtra';
import type { DetalleActividadRegistro } from '../types/trabajosExtra';
import { actividadDeFila } from './trabajos-extra';

/** Columna «Planta» de la planilla: la planta concreta cuando la fila es
 * PLANTA, el lugar legible en el resto. */
function lugarExcel(f: DetalleActividadRegistro): string {
  if (f.lugar === 'PLANTA') return f.planta ?? destinoLabel.PLANTA;
  return destinoLabel[f.lugar] ?? f.lugar;
}

/** Día local (YYYY-MM-DD) de un timestamp — el mismo día que el usuario ve en
 * la tabla de la vista Report (misma regla que su filtro). */
function diaLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `dd-mm-yyyy`, como en la planilla del cliente. */
const legible = (dia: string) => dia.split('-').reverse().join('-');

/** Actividades legibles (registro LEGACY, sin desglose); «Otro» muestra el
 * texto libre si lo trae. */
function actividadesDe(trabajo: TrabajoExtraordinario): string {
  return trabajo.actividades
    .map((a) => (a === 'OTRO' && trabajo.otraActividad ? `Otro: ${trabajo.otraActividad}` : (actividadLabel[a] ?? a)))
    .join(', ');
}

/**
 * Arma el Excel del módulo Report con las columnas de la planilla del cliente
 * (Item, Fecha, Empresa, Equipo, Supervisor, Operador, Report N°, Planta,
 * Actividad y sus horas, horómetros y total) y su formato: título con el
 * rango, encabezado en el azul del shell de SMI con filtros, cebra POR
 * TRABAJO, formatos numéricos, encabezado congelado y fila de total.
 *
 * Cada trabajo sale en UNA FILA POR ACTIVIDAD (decisión del cliente, 05-11):
 * folio, equipo, operador y fecha se repiten en cada fila; la columna
 * «Planta» es el lugar DE ESA actividad y «HM_Act» sus horas. Los horómetros,
 * el total, la descripción y las observaciones van solo en la primera fila
 * del trabajo — así la columna Total_Horas se puede sumar sin duplicar. Un
 * registro anterior al desglose sale en una sola fila, como antes.
 *
 * Vive fuera de la vista para poder probarse releyendo el archivo generado;
 * `exceljs` entra por import dinámico, así que solo se descarga al exportar.
 */
export async function construirExcelReport(
  trabajos: TrabajoExtraordinario[],
  desde: string,
  hasta: string,
): Promise<Blob> {
  // Interop CJS/ESM: en Node (vitest) el módulo llega solo como `default`;
  // en el build del navegador (Vite) trae el export con nombre.
  const excel = await import('exceljs');
  const Workbook = excel.Workbook ?? excel.default.Workbook;
  const wb = new Workbook();
  // Encabezado congelado (título + subtítulo + vacío + encabezado): al hacer
  // scroll, las columnas siguen a la vista.
  const ws = wb.addWorksheet('Report', { views: [{ state: 'frozen', ySplit: 4 }] });

  // Paleta: el azul oscuro del shell de SMI para el encabezado, gris suave
  // para la cebra, bordes apenas visibles — legible también impreso en B/N.
  const AZUL_SMI = 'FF1E293B';
  const GRIS_CEBRA = 'FFF1F5F9';
  const GRIS_TEXTO = 'FF6B7280';
  const BORDE = { style: 'thin' as const, color: { argb: 'FFD9DEE5' } };
  const N_COLUMNAS = 16;

  ws.columns = [
    { key: 'item', width: 9 },
    { key: 'fecha', width: 12 },
    { key: 'empresa', width: 12 },
    { key: 'equipo', width: 10 },
    { key: 'supervisor', width: 20 },
    { key: 'operador', width: 20 },
    { key: 'report', width: 10 },
    { key: 'planta', width: 16 },
    { key: 'actividad', width: 30 },
    { key: 'detalleAct', width: 36 },
    { key: 'horasAct', width: 9 },
    { key: 'horomIni', width: 10 },
    { key: 'horomFin', width: 10 },
    { key: 'total', width: 11 },
    { key: 'descripcion', width: 40 },
    { key: 'observaciones', width: 40 },
  ];

  // --- Título y subtítulo ----------------------------------------------------
  const titulo = ws.addRow(['Report · Trabajos extraordinarios']);
  ws.mergeCells(1, 1, 1, N_COLUMNAS);
  titulo.height = 24;
  titulo.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF111827' } };
  titulo.getCell(1).alignment = { vertical: 'middle' };

  const subtitulo = ws.addRow([
    `Del ${legible(desde)} al ${legible(hasta)} · ${trabajos.length} ${
      trabajos.length === 1 ? 'trabajo' : 'trabajos'
    } · exportado el ${legible(diaLocal(new Date().toISOString()))}`,
  ]);
  ws.mergeCells(2, 1, 2, N_COLUMNAS);
  subtitulo.getCell(1).font = { size: 10, color: { argb: GRIS_TEXTO } };

  ws.addRow([]);

  // --- Encabezado ------------------------------------------------------------
  const encabezado = ws.addRow([
    'Item',
    'Fecha',
    'Empresa',
    'Equipo',
    'Supervisor',
    'Operador',
    'Report N°',
    'Planta',
    'Actividad',
    'Detalle actividad',
    'HM_Act',
    'Horom_Ini',
    'Horom_Fin',
    'Total_Horas',
    'Descripción',
    'Observaciones',
  ]);
  encabezado.height = 20;
  encabezado.eachCell((celda) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_SMI } };
    celda.font = { bold: true, size: 10.5, color: { argb: 'FFFFFFFF' } };
    celda.alignment = { vertical: 'middle', horizontal: 'center' };
    celda.border = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };
  });
  // Filtros sobre el encabezado, como la tabla del cliente.
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: N_COLUMNAS } };

  // --- Filas -------------------------------------------------------------------
  trabajos.forEach((t, indice) => {
    // Los datos del trabajo que se repiten en cada fila de su desglose.
    const comunes = {
      item: t.turno === 'NOCTURNO' ? 'Noche' : 'Día',
      fecha: legible(diaLocal(t.fecha)),
      empresa: t.faena,
      equipo: t.equipo?.internalCode ?? t.equipoId,
      supervisor: t.registradoPor ?? '',
      report: t.reportNumero ?? '',
      operador: t.operador,
    };
    // Los que van SOLO en la primera fila: sumar Total_Horas no debe duplicar.
    const soloPrimera = {
      horomIni: t.horometroInicial,
      horomFin: t.horometroFinal,
      total: t.totalHoras,
      descripcion: t.descripcion,
      observaciones: t.observaciones ?? '',
    };
    const desglose = t.detalleActividades ?? [];
    const valores =
      desglose.length > 0
        ? desglose.map((f, j) => ({
            ...comunes,
            planta: lugarExcel(f),
            actividad: actividadDeFila(f, t.otraActividad),
            detalleAct: f.descripcion ?? '',
            horasAct: f.horas,
            ...(j === 0 ? soloPrimera : {}),
          }))
        : // Registro anterior al desglose: una sola fila, como antes.
          [{ ...comunes, planta: '', actividad: actividadesDe(t), ...soloPrimera }];

    valores.forEach((v, j) => {
      const fila = ws.addRow(v);
      fila.eachCell({ includeEmpty: true }, (celda) => {
        celda.border = { bottom: BORDE, left: BORDE, right: BORDE };
        // Cebra POR TRABAJO: todas sus filas comparten el fondo, así el
        // bloque se lee como un solo report.
        if (indice % 2 === 1) {
          celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_CEBRA } };
        }
      });
      fila.getCell('item').alignment = { horizontal: 'center' };
      fila.getCell('fecha').alignment = { horizontal: 'center' };
      fila.getCell('report').alignment = { horizontal: 'center' };
      fila.getCell('horasAct').numFmt = '#,##0.00';
      if (j === 0) {
        fila.getCell('horomIni').numFmt = '#,##0.##';
        fila.getCell('horomFin').numFmt = '#,##0.##';
        fila.getCell('total').numFmt = '#,##0.00';
        fila.getCell('total').font = { bold: true };
        // Textos largos: que crezcan hacia abajo, no hacia el costado.
        fila.getCell('descripcion').alignment = { wrapText: true, vertical: 'top' };
        fila.getCell('observaciones').alignment = { wrapText: true, vertical: 'top' };
      }
    });
  });

  // --- Total del período -------------------------------------------------------
  const totalPeriodo = trabajos.reduce((acc, t) => acc + t.totalHoras, 0);
  const filaTotal = ws.addRow({ actividad: 'Total horas del período', total: totalPeriodo });
  filaTotal.getCell('actividad').font = { bold: true };
  filaTotal.getCell('actividad').alignment = { horizontal: 'right' };
  filaTotal.getCell('total').numFmt = '#,##0.00';
  filaTotal.getCell('total').font = { bold: true };
  filaTotal.eachCell({ includeEmpty: true }, (celda) => {
    celda.border = { top: { style: 'double' as const, color: { argb: 'FF111827' } } };
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
