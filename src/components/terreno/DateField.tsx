import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { fromDateOnly, toDateOnly } from '../../lib/turno';
import { Label } from './ui';

/**
 * Selector de fecha del kit de Terreno — reemplaza al `<input type="date">`
 * nativo ("muy default", pedido del cliente 05/11) en los cuatro módulos del
 * supervisor. Diseñado para faena: gatillo de 48px con la fecha legible,
 * panel que se EXPANDE INLINE (sin portales: funciona dentro de `Hoja` y
 * `ModalTerreno`), accesos rápidos Hoy/Ayer, semana lunes-primero es-CL y
 * celdas táctiles de 44px. La ventana `min`/`max` apaga los días y frena la
 * navegación de mes — el mismo borde de 30 días que valida el backend.
 */

const DIAS_SEMANA = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];

const fmtMes = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' });
const fmtDiaLargo = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const fmtGatillo = new Intl.DateTimeFormat('es-CL', { weekday: 'short' });

/** `Noviembre de 2026` — solo la inicial en mayúscula (la clase `capitalize`
 * de Tailwind pondría «Noviembre De 2026»). */
function tituloMes(mes: Date): string {
  const texto = fmtMes.format(mes);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** `mié 03-11-2026` — día de semana + fecha tabular, como el resto del kit. */
function etiquetaFecha(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${fmtGatillo.format(d).replace('.', '')} ${dd}-${mm}-${d.getFullYear()}`;
}

/** Lunes-primero: cuántas celdas vacías van antes del día 1. */
function offsetLunes(primerDia: Date): number {
  return (primerDia.getDay() + 6) % 7;
}

const mismoMes = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export function DateField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  /** `YYYY-MM-DD` — mismo contrato que el input nativo que reemplaza. */
  value: string;
  onChange: (dateOnly: string) => void;
  min?: string;
  max?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const elegida = fromDateOnly(value);
  const [mes, setMes] = useState(() => new Date(elegida.getFullYear(), elegida.getMonth(), 1));

  const hoy = toDateOnly(new Date());
  const ayer = toDateOnly(new Date(Date.now() - 86_400_000));
  const dentro = (d: string) => (!min || d >= min) && (!max || d <= max);

  const dias = useMemo(() => {
    const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    return Array.from({ length: total }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1));
  }, [mes]);

  const elegir = (d: Date) => {
    onChange(toDateOnly(d));
    setAbierto(false);
  };
  const abrir = () => {
    // El panel siempre abre en el mes de la fecha elegida, no donde quedó.
    setMes(new Date(elegida.getFullYear(), elegida.getMonth(), 1));
    setAbierto((a) => !a);
  };

  const mesAnterior = new Date(mes.getFullYear(), mes.getMonth() - 1, 1);
  const mesSiguiente = new Date(mes.getFullYear(), mes.getMonth() + 1, 1);
  // Se puede navegar mientras ALGÚN día del mes destino caiga en la ventana.
  const puedeIrAtras = !min || toDateOnly(new Date(mes.getFullYear(), mes.getMonth(), 0)) >= min;
  const puedeIrAdelante = !max || toDateOnly(mesSiguiente) <= max;

  const chipRapido = (texto: string, dateOnly: string) =>
    dentro(dateOnly) && (
      <button
        type="button"
        onClick={() => elegir(fromDateOnly(dateOnly))}
        className={`inline-flex min-h-[36px] cursor-pointer items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
          value === dateOnly ? 'bg-foreground text-white' : 'bg-[#eef0f2] text-[#3a414b] hover:bg-[#e4e7ea]'
        }`}
      >
        {texto}
      </button>
    );

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <button
        type="button"
        aria-label={label}
        aria-expanded={abierto}
        onClick={abrir}
        className="flex min-h-[48px] cursor-pointer items-center justify-between gap-2 rounded-2xl border border-[var(--line2,#c3c9d1)] bg-card px-3.5 text-left text-[15.5px] font-semibold hover:border-foreground"
      >
        <span className="inline-flex items-center gap-2.5">
          <CalendarDays className="h-[19px] w-[19px] text-muted-foreground" aria-hidden />
          <span className="tabular">{etiquetaFecha(elegida)}</span>
        </span>
        <ChevronDown
          className={`h-[18px] w-[18px] text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {abierto && (
        <div className="rounded-2xl border border-border bg-card p-3 shadow-[0_8px_24px_rgba(20,23,28,.08)]">
          {/* Accesos rápidos: lo que más se elige en la carga histórica. */}
          <div className="mb-2.5 flex gap-1.5">
            {chipRapido('Hoy', hoy)}
            {chipRapido('Ayer', ayer)}
          </div>

          <div className="mb-1.5 flex items-center justify-between">
            <button
              type="button"
              aria-label="Mes anterior"
              disabled={!puedeIrAtras}
              onClick={() => setMes(mesAnterior)}
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl bg-[#eef0f2] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <span className="font-display text-[15.5px] font-bold">{tituloMes(mes)}</span>
            <button
              type="button"
              aria-label="Mes siguiente"
              disabled={!puedeIrAdelante}
              onClick={() => setMes(mesSiguiente)}
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl bg-[#eef0f2] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center">
            {DIAS_SEMANA.map((d) => (
              <span
                key={d}
                className="py-1 text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase"
              >
                {d}
              </span>
            ))}
            {Array.from({ length: offsetLunes(dias[0]) }, (_, i) => (
              <span key={`v${i}`} aria-hidden />
            ))}
            {dias.map((d) => {
              const key = toDateOnly(d);
              const esElegida = key === value;
              const esHoy = key === hoy;
              const habilitado = dentro(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={fmtDiaLargo.format(d)}
                  aria-pressed={esElegida}
                  disabled={!habilitado}
                  onClick={() => elegir(d)}
                  className={`tabular mx-auto my-0.5 grid h-11 w-11 cursor-pointer place-items-center rounded-full text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:text-[#c3c9d1] ${
                    esElegida
                      ? 'bg-[var(--accent)] text-white shadow-[0_2px_8px_rgba(30,80,234,.35)]'
                      : esHoy
                        ? 'ring-[1.5px] ring-[var(--accent)] ring-inset text-[var(--accent)] hover:bg-[var(--accent-soft)]'
                        : 'hover:bg-[#eef0f2]'
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {!mismoMes(mes, elegida) && (
            <button
              type="button"
              onClick={() => setMes(new Date(elegida.getFullYear(), elegida.getMonth(), 1))}
              className="mt-1 w-full cursor-pointer rounded-xl py-2 text-center text-[13px] font-semibold text-[var(--accent)]"
            >
              Volver a {etiquetaFecha(elegida)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
