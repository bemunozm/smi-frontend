import { actividadLabel, destinoLabel, type TrabajoExtraordinario } from '../types/trabajosExtra';

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

/** Actividades legibles; «Otro» muestra el texto libre si lo trae. */
function actividadesDe(trabajo: TrabajoExtraordinario): string {
  return trabajo.actividades
    .map((a) => (a === 'OTRO' && trabajo.otraActividad ? `Otro: ${trabajo.otraActividad}` : (actividadLabel[a] ?? a)))
    .join(', ');
}

/** Columna «Planta» de la planilla: la planta concreta cuando el destino es
 * PLANTA, el destino legible en el resto, vacío en registros previos al campo. */
function plantaDe(trabajo: TrabajoExtraordinario): string {
  if (!trabajo.destino) return '';
  if (trabajo.destino === 'PLANTA') return trabajo.planta ?? destinoLabel.PLANTA;
  return destinoLabel[trabajo.destino] ?? trabajo.destino;
}

/**
 * Arma el Excel del módulo Report con las columnas de la planilla del cliente
 * (Item, Fecha, Empresa, Equipo, Supervisor, Operador, Report N°, Planta,
 * Actividad, horómetros y total) y su formato: título con el rango,
 * encabezado en el azul del shell de SMI con filtros, cebra en las filas,
 * formatos numéricos, encabezado congelado y fila de total del período.
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
  const N_COLUMNAS = 14;

  ws.columns = [
    { key: 'item', width: 9 },
    { key: 'fecha', width: 12 },
    { key: 'empresa', width: 12 },
    { key: 'equipo', width: 10 },
    { key: 'supervisor', width: 20 },
    { key: 'operador', width: 20 },
    { key: 'report', width: 10 },
    { key: 'planta', width: 14 },
    { key: 'actividad', width: 36 },
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
    const fila = ws.addRow({
      item: t.turno === 'NOCTURNO' ? 'Noche' : 'Día',
      fecha: legible(diaLocal(t.fecha)),
      empresa: t.faena,
      equipo: t.equipo?.internalCode ?? t.equipoId,
      supervisor: t.registradoPor ?? '',
      report: t.reportNumero ?? '',
      operador: t.operador,
      planta: plantaDe(t),
      actividad: actividadesDe(t),
      horomIni: t.horometroInicial,
      horomFin: t.horometroFinal,
      total: t.totalHoras,
      descripcion: t.descripcion,
      observaciones: t.observaciones ?? '',
    });
    fila.eachCell({ includeEmpty: true }, (celda) => {
      celda.border = { bottom: BORDE, left: BORDE, right: BORDE };
      if (indice % 2 === 1) {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_CEBRA } };
      }
    });
    fila.getCell('item').alignment = { horizontal: 'center' };
    fila.getCell('fecha').alignment = { horizontal: 'center' };
    fila.getCell('report').alignment = { horizontal: 'center' };
    fila.getCell('horomIni').numFmt = '#,##0.##';
    fila.getCell('horomFin').numFmt = '#,##0.##';
    fila.getCell('total').numFmt = '#,##0.00';
    fila.getCell('total').font = { bold: true };
    // Textos largos: que crezcan hacia abajo, no hacia el costado.
    fila.getCell('descripcion').alignment = { wrapText: true, vertical: 'top' };
    fila.getCell('observaciones').alignment = { wrapText: true, vertical: 'top' };
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
