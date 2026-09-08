const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat('es-CL', { numeric: 'auto', style: 'short' });

/** De más a menos preciso — se usa la primera unidad cuya magnitud cabe en la diferencia. */
const UNITS: ReadonlyArray<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
];

/**
 * Tiempo relativo en español ("hace 5 min", "hace 2 h", "ayer") con
 * `Intl.RelativeTimeFormat` (`style: 'short'`, que en `es-CL` abrevia
 * minutos/horas y deja "ayer" tal cual para -1 día). `now` es inyectable
 * para tests deterministas.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = date.getTime() - now.getTime();
  const diffAbsMs = Math.abs(diffMs);

  if (diffAbsMs < 60_000) return 'ahora';

  const match = UNITS.find(({ ms }) => diffAbsMs >= ms) ?? UNITS[UNITS.length - 1];
  return RELATIVE_TIME_FORMATTER.format(Math.round(diffMs / match.ms), match.unit);
}
