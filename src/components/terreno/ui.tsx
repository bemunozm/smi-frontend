import { cloneElement, useId } from 'react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Kit visual de Terreno, según la maqueta aprobada el 23/09/2026.
 *
 * Convive con `mobile.tsx` a propósito: ese archivo es el kit anterior y las
 * vistas todavía sin migrar lo siguen usando. La migración va vista por vista;
 * cuando no quede ninguna, `mobile.tsx` se borra.
 *
 * Todo lo de acá está pensado para una tablet a pleno sol y con guantes:
 * campos de 52 px, objetivos de toque grandes y contraste alto. Los tamaños no
 * son decorativos — bajarlos rompe el uso real.
 */

/* ---------- Encabezado de vista ---------- */

/**
 * Título de la pantalla más los chips de contexto: en qué faena, qué turno y
 * qué día se está registrando. El supervisor abre la app a las 8 de la mañana
 * después de un turno de noche; que la pantalla diga dónde está parado evita
 * el registro cargado en el turno equivocado.
 */
export function VistaHead({ titulo, contexto }: { titulo: string; contexto?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-2.5 lg:mb-5 lg:flex-row lg:items-end lg:justify-between">
      <h1 className="text-[23px] leading-tight font-bold tracking-[-0.015em] text-balance lg:text-[28px]">
        {titulo}
      </h1>
      {contexto && <div className="flex flex-wrap gap-1.5">{contexto}</div>}
    </div>
  );
}

/** Chip de contexto: fondo blanco y borde, para no competir con los de estado. */
export function ChipContexto({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-[30px] items-center rounded-full border border-border bg-card px-2.5 text-xs font-semibold">
      {children}
    </span>
  );
}

/* ---------- Chips de estado ---------- */

export type Tono = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const tonos: Record<Tono, string> = {
  neutral: 'bg-[var(--default)] text-[var(--default-foreground)]',
  info: 'bg-[var(--accent-soft)] text-[var(--accent-soft-foreground)]',
  success: 'bg-[var(--success-soft)] text-[var(--success-soft-foreground)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning-soft-foreground)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger-soft-foreground)]',
};

export function Chip({
  tono = 'neutral',
  children,
  className = '',
}: {
  tono?: Tono;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex min-h-[26px] items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold tracking-[0.02em] whitespace-nowrap ${tonos[tono]} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Chip de estado con contorno y punto, para lo que avanza por etapas
 * (abierto → en proceso → cerrado). Se distingue a propósito de los chips
 * sólidos, que marcan una categoría y no un avance.
 */
export function ChipEstado({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="inline-flex min-h-[26px] items-center gap-1.5 rounded-full border-[1.5px] bg-card px-2.5 text-xs font-semibold whitespace-nowrap"
      style={{ color, borderColor: color }}
    >
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

/* ---------- Tarjeta ---------- */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl border border-border bg-card px-4 py-[18px] shadow-[0_1px_2px_rgba(20,23,28,.04),0_6px_18px_rgba(20,23,28,.04)] ${className}`}
    >
      {children}
    </div>
  );
}

/** Encabezado de tarjeta: qué es y, en una línea, para qué sirve. */
export function CardHead({ titulo, bajada, extra }: { titulo: ReactNode; bajada?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-3.5 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[17px] leading-tight font-bold tracking-[-0.01em]">{titulo}</h2>
        {bajada && <p className="mt-0.5 text-[13px] text-muted-foreground">{bajada}</p>}
      </div>
      {extra}
    </div>
  );
}

/** Pila vertical de campos con la separación estándar del formulario. */
export function Form({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-3.5 ${className}`}>{children}</div>;
}

/* ---------- Campos ---------- */

export function Label({ children, requerido }: { children: ReactNode; requerido?: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-2 text-[11.5px] font-bold tracking-[0.08em] text-[var(--label-color)] uppercase">
      {children}
      {requerido && (
        <em className="rounded-md bg-[var(--danger-soft)] px-1.5 py-px text-[10.5px] font-normal tracking-[0.06em] text-[var(--danger)] not-italic">
          Obligatorio
        </em>
      )}
    </span>
  );
}

/** Texto de apoyo bajo un campo. Explica la regla, no la repite. */
export function Hint({ children }: { children: ReactNode }) {
  return <span className="text-[12.5px] leading-snug text-muted-foreground">{children}</span>;
}

const INPUT =
  'h-[52px] w-full rounded-2xl border-[1.5px] border-[var(--line2,#c3c9d1)] bg-card px-3.5 text-base text-foreground focus:border-[var(--accent)] focus:outline-3 focus:outline-[rgba(29,78,216,.18)]';

/**
 * Campo con su etiqueta y, si hace falta, una ayuda debajo.
 *
 * La ayuda NO va dentro del `<label>`: si fuera, se sumaría al nombre accesible
 * del control y un lector de pantalla anunciaría «Equipo Solo equipos
 * operativos, CA-003 no aparece porque…» cada vez que el foco entra al campo.
 * Va aparte y se enlaza con `aria-describedby`, que es como se lee después del
 * nombre y solo una vez.
 */
export function Campo({
  label,
  requerido,
  hint,
  unidad,
  children,
}: {
  label?: ReactNode;
  requerido?: boolean;
  hint?: ReactNode;
  /** Sufijo fijo dentro del campo: `h`, `L`, `t`, `%`. */
  unidad?: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string }>;
}) {
  const base = useId();
  const idCampo = `${base}-campo`;
  const idHint = `${base}-hint`;

  const control = cloneElement(children, {
    id: children.props.id ?? idCampo,
    'aria-describedby': hint ? idHint : children.props['aria-describedby'],
  });

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {label && (
        <label htmlFor={children.props.id ?? idCampo}>
          <Label requerido={requerido}>{label}</Label>
        </label>
      )}
      {unidad ? (
        <span className="relative block">
          {control}
          <span className="tabular pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted-foreground">
            {unidad}
          </span>
        </span>
      ) : (
        control
      )}
      {hint && (
        <span id={idHint}>
          <Hint>{hint}</Hint>
        </span>
      )}
    </div>
  );
}

export function Input({
  numerico,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { numerico?: boolean }) {
  return (
    <input
      {...props}
      inputMode={numerico ? 'decimal' : props.inputMode}
      className={`${INPUT} ${numerico ? 'tabular pr-11 text-[17px]' : ''} ${className}`}
    />
  );
}

export function Select({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${INPUT} appearance-none bg-[right_0.875rem_center] bg-no-repeat pr-10 font-medium ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2314171c' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT} h-auto min-h-[84px] resize-y py-3 leading-snug ${className}`} />;
}

/* ---------- Botones ---------- */

const BTN =
  'inline-flex min-h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-2xl px-5 text-[15.5px] font-semibold disabled:cursor-not-allowed disabled:bg-[#c9ced6] disabled:text-white';

export function Boton({
  variante = 'oscuro',
  ancho,
  className = '',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'oscuro' | 'acento' | 'contorno';
  ancho?: boolean;
}) {
  const estilos = {
    oscuro: 'bg-secondary text-secondary-foreground hover:bg-black',
    acento: 'bg-[var(--accent)] text-white hover:bg-[#1740b3]',
    contorno: 'border-[1.5px] border-[var(--line2,#c3c9d1)] bg-card text-foreground hover:border-foreground',
  }[variante];
  return (
    <button {...props} className={`${BTN} ${estilos} ${ancho ? 'w-full' : ''} ${className}`}>
      {children}
    </button>
  );
}

/* ---------- Selectores grandes ---------- */

/**
 * Segmentado: pocas opciones excluyentes, todas visibles. Un `select` escondería
 * la elección detrás de un toque extra, y el turno o la faena son la clase de
 * dato que conviene ver sin abrir nada.
 */
export function Segmentado<T extends string>({
  valor,
  onChange,
  opciones,
  etiqueta,
}: {
  valor: T;
  onChange: (v: T) => void;
  opciones: { valor: T; label: string; sub?: string; colorActivo?: string }[];
  etiqueta: string;
}) {
  return (
    <div role="group" aria-label={etiqueta} className="grid auto-cols-fr grid-flow-col gap-1.5 rounded-2xl bg-[#eef0f2] p-1">
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(o.valor)}
            className={`flex min-h-[46px] cursor-pointer flex-col items-center justify-center rounded-xl text-[14.5px] leading-tight font-semibold ${
              activo ? 'text-foreground shadow-[0_1px_3px_rgba(20,23,28,.14)]' : 'text-[#3a414b]'
            }`}
            style={activo ? { background: o.colorActivo ?? '#fff', color: o.colorActivo ? '#fff' : undefined } : undefined}
          >
            {o.label}
            {o.sub && (
              <small className={`tabular text-[11.5px] font-medium ${activo && o.colorActivo ? 'text-white/70' : 'text-muted-foreground'}`}>
                {o.sub}
              </small>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Chip con casilla: multi-selección que se puede tocar con guantes. */
export function Pick({
  activo,
  onToggle,
  children,
}: {
  activo: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onToggle}
      className={`inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-2xl border-[1.5px] px-3.5 text-[14.5px] ${
        activo
          ? 'border-[var(--accent)] bg-[#f0f4ff] font-semibold text-[#12308f]'
          : 'border-[var(--line2,#c3c9d1)] bg-card font-medium text-foreground'
      }`}
    >
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-[1.5px] ${
          activo ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--line2,#c3c9d1)]'
        }`}
      >
        {activo && (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      {children}
    </button>
  );
}

/* ---------- Bloques de solo lectura ---------- */

/**
 * Valor que el sistema pone solo (turno, fecha, supervisor) o que calcula.
 * Se muestra en vez de ocultarse: el supervisor firma ese registro, así que
 * tiene que poder ver con qué turno y con qué fecha quedó.
 */
export function Automaticos({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-[#fafaf8]">{children}</div>
  );
}

export function Automatico({ label, valor, nota = 'Automático' }: { label: string; valor: ReactNode; nota?: string }) {
  return (
    <div className="flex min-h-[50px] items-center justify-between gap-2.5 px-3.5 py-2.5 not-first:border-t not-first:border-border">
      <Label>{label}</Label>
      <b className="flex-1 text-[15px] font-semibold">{valor}</b>
      <em className="text-[11px] font-bold tracking-[0.06em] text-[var(--accent-soft-foreground)] uppercase not-italic">
        {nota}
      </em>
    </div>
  );
}

/** Resultado calculado y no editable, destacado en azul. */
export function Calculado({ label, valor, nota }: { label: string; valor: ReactNode; nota?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2.5 rounded-2xl bg-[var(--accent-soft)] px-3.5 py-3 text-[var(--accent-soft-foreground)]">
      <div className="flex flex-col gap-0.5">
        <Label>{label}</Label>
        {nota && <em className="text-[11.5px] font-semibold not-italic">{nota}</em>}
      </div>
      <b className="tabular text-2xl font-semibold text-[#0f2a7a]">{valor}</b>
    </div>
  );
}

/* ---------- Historial ---------- */

/** Encabezado de un grupo del historial: qué es y cuántos hay. */
export function GrupoHead({ titulo, detalle }: { titulo: ReactNode; detalle?: ReactNode }) {
  return (
    <div className="mx-0.5 mt-1 flex items-baseline justify-between gap-2.5">
      <h3 className="text-sm font-bold">{titulo}</h3>
      {detalle && <span className="text-[12.5px] text-muted-foreground">{detalle}</span>}
    </div>
  );
}

export function Tarjeta({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <article
      className={`flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(20,23,28,.04),0_6px_18px_rgba(20,23,28,.04)] ${className}`}
      style={style}
    >
      {children}
    </article>
  );
}

/**
 * Bloque de cifras de una tarjeta. Van juntas y alineadas porque se comparan
 * entre sí y entre tarjetas — sueltas en el texto hay que ir a buscarlas.
 */
export function Cifras({ items }: { items: { label: string; valor: ReactNode; destacado?: boolean }[] }) {
  return (
    <dl
      className="m-0 grid overflow-hidden rounded-2xl border border-[#e6e8eb]"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((i) => (
        <div key={i.label} className="bg-[#fafbfc] px-2.5 py-2 not-first:border-l not-first:border-[#e6e8eb]">
          <dt className="text-[10.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">{i.label}</dt>
          <dd
            className={`tabular mt-0.5 text-[14.5px] whitespace-nowrap ${
              i.destacado ? 'font-semibold text-[#0f2a7a]' : 'font-medium'
            }`}
          >
            {i.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Tabla del historial en escritorio, con el mismo marco que las tarjetas. */
export function Tabla({ titulo, detalle, children }: { titulo: string; detalle?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-[0_1px_2px_rgba(20,23,28,.04),0_6px_18px_rgba(20,23,28,.04)]">
      <table className="w-full border-collapse text-sm">
        <caption className="px-4 pt-3.5 pb-2.5 text-left text-sm font-bold">
          {titulo}
          {detalle && <span className="ml-2 text-[13px] font-normal text-muted-foreground">{detalle}</span>}
        </caption>
        {children}
      </table>
    </div>
  );
}

export const TH = 'border-b border-border bg-[#fafbfc] px-3 py-2.5 text-left text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase whitespace-nowrap';
export const TD = 'border-b border-[#eceef1] px-3 py-3 align-middle';

/**
 * Hoja inferior en teléfono y tablet, diálogo centrado desde `lg`.
 *
 * Es `fixed` y no `absolute`: tiene que tapar la pantalla completa, y el shell
 * de Terreno crece con el contenido — anclarla al shell la dejaría a mitad de
 * camino en una vista larga.
 */
export function Hoja({
  titulo,
  bajada,
  eyebrow,
  onCerrar,
  children,
}: {
  titulo: string;
  bajada?: ReactNode;
  eyebrow?: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="fixed inset-0 z-40 bg-[#0d0c0a]/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[88%] overflow-y-auto rounded-t-[28px] bg-card shadow-[0_-10px_40px_rgba(13,12,10,.2)] lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:left-1/2 lg:max-h-[86%] lg:w-[600px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl"
      >
        <div className="mx-auto flex max-w-md flex-col gap-3.5 px-4 pt-2.5 pb-[22px] sm:max-w-[560px] lg:max-w-none lg:px-6 lg:pt-[22px] lg:pb-6">
          <div className="mx-auto mb-1 h-[5px] w-11 rounded-full bg-[#cfd4da] lg:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div>
              {eyebrow && <Label>{eyebrow}</Label>}
              <h2 className="mt-1 text-[19px] font-bold tracking-[-0.01em]">{titulo}</h2>
              {bajada && <p className="mt-0.5 text-[13.5px] text-muted-foreground">{bajada}</p>}
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-[#eef0f2]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

/**
 * Formulario e historial, uno al lado del otro desde `lg`. El formulario
 * conserva ancho de formulario; el sobrante se lo lleva el historial, que es
 * lo que la tabla necesita.
 */
export function VistaSplit({ formulario, historial }: { formulario: ReactNode; historial: ReactNode }) {
  return (
    <div className="lg:grid lg:grid-cols-[416px_minmax(0,1fr)] lg:items-start lg:gap-6">
      <section className="flex flex-col gap-3.5">{formulario}</section>
      <section className="mt-5 flex min-w-0 flex-col gap-3.5 lg:mt-0">{historial}</section>
    </div>
  );
}
