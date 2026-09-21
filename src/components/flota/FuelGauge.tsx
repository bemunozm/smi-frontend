import { FUEL_TONE_CLASSES, fuelTone } from '../../config/flota-colors';

/**
 * Barra de combustible (nivel % del último `RegistroHorometro`). Vive en
 * `components/flota/` (no local a `EquiposView`) porque la ficha de equipo
 * (Fase 2) va a necesitar el mismo indicador — ver `types/equipment.ts:
 * currentFuelLevel`.
 *
 * `fuelTone`/`FUEL_TONE_CLASSES` (umbral ≤20% peligro, ≤50% advertencia,
 * resto éxito — calca `FlotaClientePC.dc.html#fuelColor`) viven en
 * `config/flota-colors.ts`, no acá: `EquipoDetalleView` (Fase 2) también los
 * necesita (barra grande de "Nivel actual" + badge del KPI de combustible) y
 * un archivo que solo exporta el componente mantiene el fast refresh de Vite
 * intacto (oxlint `react(only-export-components)`).
 */

interface FuelGaugeProps {
  /** `null` = sin registros de horómetro todavía. */
  pct: number | null;
  className?: string;
}

export function FuelGauge({ pct, className }: FuelGaugeProps) {
  if (pct == null) {
    return <span className={`text-sm text-(--muted) ${className ?? ''}`}>—</span>;
  }

  const tone = FUEL_TONE_CLASSES[fuelTone(pct)];
  const pctAcotado = Math.max(0, Math.min(100, pct));

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`} role="meter" aria-label="Nivel de combustible" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-surface-tertiary">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pctAcotado}%` }} />
      </div>
      <span className={`font-mono text-xs font-semibold ${tone.text}`}>{pct}%</span>
    </div>
  );
}
