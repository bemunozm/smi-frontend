/**
 * «45 min», «3 h 10 min», «1 día 4 h» — cuánto lleva abierta una tarjeta de
 * turno. Fuente única: la usan «Mi camioneta» (la propia del mantenedor) y el
 * popup «Uso en curso» del listado de Equipos.
 */
export function tiempoEnUso(desdeIso: string | undefined, ahora: Date): string {
  if (!desdeIso) return "—";
  const min = Math.max(
    0,
    Math.floor((ahora.getTime() - new Date(desdeIso).getTime()) / 60000),
  );
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "día" : "días"}${h % 24 ? ` ${h % 24} h` : ""}`;
}
