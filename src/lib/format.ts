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
