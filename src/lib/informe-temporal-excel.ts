import { turnoLabel } from '../config/flota-colors';
import { equiposDelInforme } from './informe-antiguo';
import type { InformeTemporal } from '../types/informe-temporal';

const COLUMNAS = [
  { header: 'N°', key: 'numero', width: 8 },
  { header: 'Fecha', key: 'fecha', width: 12 },
  { header: 'Turno', key: 'turno', width: 9 },
  { header: 'Supervisor', key: 'supervisor', width: 22 },
  { header: 'Actividad 1', key: 'actividad1', width: 32 },
  { header: 'Actividad 2', key: 'actividad2', width: 32 },
  { header: 'Equipo', key: 'equipo', width: 12 },
  { header: 'Lectura inicial', key: 'inicial', width: 14 },
  { header: 'Lectura final', key: 'final', width: 14 },
  { header: 'Total', key: 'total', width: 10 },
  { header: 'Combustible (L)', key: 'combustible', width: 16 },
  { header: 'Personal act. 1', key: 'personal1', width: 30 },
  { header: 'Personal act. 2', key: 'personal2', width: 30 },
  { header: 'Observaciones', key: 'observaciones', width: 40 },
  { header: 'Supervisor responsable 1', key: 'responsable1', width: 24 },
  { header: 'Supervisor responsable 2', key: 'responsable2', width: 24 },
  { header: 'AdBlue (L)', key: 'adBlue', width: 12 },
  // Informe en papel digitalizado después: sus equipos se escribieron a mano.
  { header: 'Subido después', key: 'antiguo', width: 15 },
] as const;

/** `dd-mm-yyyy`, como en la planilla del cliente. */
const legible = (dia: string) => dia.split('-').reverse().join('-');

/**
 * Arma el Excel de «Report supervisor temporal»: UNA FILA POR EQUIPO (la
 * tarjeta cerrada en el informe o, en uno subido después, el equipo escrito a
 * mano); los datos del informe se repiten en cada una. `Total` es la lectura
 * final menos la inicial (vacío si la tarjeta no tiene final). Un informe sin
 * equipos sale en una fila, con el equipo vacío.
 *
 * `exceljs` entra por import dinámico: solo se descarga al exportar.
 */
export async function construirExcelInformesTemporales(informes: InformeTemporal[]): Promise<ArrayBuffer> {
  // Interop CJS/ESM: en Node (vitest) el módulo llega solo como `default`.
  const excel = await import('exceljs');
  const Workbook = excel.Workbook ?? excel.default.Workbook;
  const wb = new Workbook();
  const ws = wb.addWorksheet('Report supervisor temporal', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLUMNAS.map((c) => ({ ...c }));

  ws.getRow(1).eachCell((celda) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNAS.length } };

  for (const informe of informes) {
    const personalDe = (actividad: 1 | 2) =>
      informe.personal
        .filter((p) => p.actividad === actividad)
        .map((p) => p.nombre)
        .join(', ');
    const comunes = {
      numero: informe.numero,
      fecha: legible(informe.fecha),
      turno: turnoLabel(informe.turno),
      supervisor: informe.supervisorNombre,
      actividad1: informe.actividad1,
      actividad2: informe.actividad2 ?? '',
      personal1: personalDe(1),
      personal2: personalDe(2),
      observaciones: informe.observaciones ?? '',
      responsable1: informe.supervisorResponsable1,
      responsable2: informe.supervisorResponsable2 ?? '',
      antiguo: informe.antiguo ? 'Sí' : undefined,
    };
    const equipos = equiposDelInforme(informe);
    for (const t of equipos.length > 0 ? equipos : [null]) {
      ws.addRow({
        ...comunes,
        equipo: t?.codigo ?? '',
        inicial: t?.inicial,
        final: t?.final ?? undefined,
        total: t && t.final != null ? Math.round((t.final - t.inicial) * 100) / 100 : undefined,
        combustible: t?.litros ?? undefined,
        adBlue: t?.adBlue ?? undefined,
      });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
