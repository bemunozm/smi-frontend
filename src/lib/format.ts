export const fmtNum = (n: number) => n.toLocaleString('es-CL');
export const fmtMoney = (n: number) =>
  n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-CL');
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
export const initials = (name: string) =>
  name
    .split(/\s|·/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

/**
 * "1 equipo" / "2 equipos" — pluralización simple es-CL, compartida entre
 * `views/RegistroEquipoView.tsx` y `components/terreno/SyncStatus.tsx`
 * (Fase 5, revisión de offline: antes cada uno tenía su copia local, o
 * directamente no pluralizaba y siempre decía "1 equipos"). Solo cubre el
 * SUSTANTIVO — un verbo que también cambia con la cantidad ("requiere" /
 * "requieren") se sigue resolviendo aparte en el llamador.
 */
export const plural = (n: number, singular: string, varias: string) => `${n} ${n === 1 ? singular : varias}`;
