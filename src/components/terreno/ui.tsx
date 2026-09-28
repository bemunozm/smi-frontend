import { cloneElement, useId } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  Button as AriaButton,
  Dialog,
  Heading,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  Popover,
  Select as AriaSelect,
  SelectValue,
} from 'react-aria-components';
import { Check, ChevronDown, Moon, Sun, X } from 'lucide-react';

import type { Turno } from '../../lib/turno';

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

/* ---------- Turno ---------- */

/**
 * Identidad visual de cada turno. El diurno es claro y cálido, el nocturno es
 * el negro del encabezado: la diferencia se lee de reojo, sin llegar a leer la
 * palabra. Es lo que evita el error que importa —cargar un registro en el
 * turno equivocado— en una tablet a pleno sol donde nadie se detiene a leer.
 */
export const TURNO_ESTILO: Record<
  Turno,
  { fondo: string; texto: string; suave: string; acento: string; Icono: typeof Sun }
> = {
  DIURNO: {
    fondo: '#f6b73c',
    texto: '#2a1e04',
    suave: '#fdf3e0',
    acento: '#b86e00',
    Icono: Sun,
  },
  NOCTURNO: {
    fondo: 'var(--terreno-head)',
    texto: '#ffffff',
    suave: '#e8eaf0',
    acento: '#2e3650',
    Icono: Moon,
  },
};

/**
 * Cabecera de turno: lo primero de la pantalla y lo más grande. Antes esta
 * información eran tres renglones chicos al fondo del formulario («automáticos»),
 * donde nadie los miraba. El turno, el día y la hora son el encabezado del
 * registro que el supervisor está firmando: si se equivoca de turno, todo lo
 * que cargue queda mal atribuido, y eso solo se descubre al día siguiente.
 */
export function CabeceraTurno({
  turno,
  fecha,
  hora,
  supervisor,
  extra,
}: {
  turno: Turno;
  /** Día del turno (`mié 24/09`), que de madrugada NO es el del reloj. */
  fecha: string;
  /** Hora del reloj, en vivo. */
  hora: string;
  supervisor: ReactNode;
  extra?: ReactNode;
}) {
  const { fondo, texto, Icono } = TURNO_ESTILO[turno];
  return (
    <section
      className="mb-4 flex flex-col gap-3 rounded-3xl px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 lg:mb-5"
      style={{ background: fondo, color: texto }}
      aria-label={`Turno ${turno}`}
    >
      <div className="flex items-center gap-3">
        <Icono className="h-7 w-7 shrink-0" strokeWidth={2.2} aria-hidden />
        <div className="min-w-0">
          <div className="text-[22px] leading-none font-bold tracking-[-0.01em] sm:text-[26px]">
            TURNO {turno}
          </div>
          <div className="mt-1 text-[13.5px] font-semibold opacity-85">
            {fecha} · {hora}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
        {extra}
        <span
          className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3"
          style={{ background: 'rgba(255,255,255,.22)' }}
        >
          Supervisor: {supervisor}
        </span>
      </div>
    </section>
  );
}

/**
 * Bloque de un turno en teléfono y tablet: la versión en tarjetas de `Tabla`.
 * Mismo marco redondeado y misma cabecera de color que en escritorio, así el
 * turno se ve como UN panel en cualquier tamaño y no como una franja recta de
 * borde a borde con tarjetas sueltas debajo.
 *
 * El fondo del cuerpo lleva el tono suave del turno: es lo que mantiene el
 * contexto al bajar por veinte tarjetas, sin la franja `sticky` de antes, que
 * quedaba escondida detrás del header del módulo (también `sticky top-0`).
 */
export function BloqueTurno({
  turno,
  fecha,
  detalle,
  children,
}: {
  turno: Turno;
  fecha: string;
  detalle?: ReactNode;
  children: ReactNode;
}) {
  const { fondo, texto, suave, Icono } = TURNO_ESTILO[turno];
  return (
    <section
      className="overflow-hidden rounded-3xl border border-border shadow-[0_1px_2px_rgba(20,23,28,.04),0_6px_18px_rgba(20,23,28,.04)]"
      style={{ background: suave }}
    >
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: fondo, color: texto }}>
        <Icono className="h-[17px] w-[17px] shrink-0" strokeWidth={2.4} aria-hidden />
        <h3 className="text-sm font-bold">
          TURNO {turno} · {fecha}
        </h3>
        {detalle && <span className="ml-auto text-[13px] font-semibold opacity-85">{detalle}</span>}
      </div>
      <div className="flex flex-col gap-3 p-3 sm:p-3.5">{children}</div>
    </section>
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

/** Una opción de `Selector`. */
export interface OpcionSelector {
  valor: string;
  /** Lo que identifica la opción: `BD-005`, `Sebastián Tapia`. */
  titulo: string;
  /** Lo que la acompaña en gris: `Bulldozer`. */
  detalle?: string;
  /** Visible pero no elegible, con el motivo debajo: `Ocupado, en turno`. */
  motivo?: string;
}

/**
 * Desplegable del kit de Terreno.
 *
 * Reemplaza al `<select>` nativo, cuya lista abierta la dibuja el sistema
 * operativo: en Windows salía con la letra y el azul de Windows, a 20 px por
 * fila, sin nada del kit. Acá la lista es del módulo — mismos radios, mismo
 * foco, filas de 48 px para acertarle con guantes, el código del equipo en
 * cifra tabular y su tipo en gris, y las opciones que no se pueden elegir
 * a la vista pero apagadas y diciendo por qué.
 *
 * Se arma sobre `react-aria-components`, igual que `ModalTerreno`: de ahí
 * vienen el teclado (flechas, Enter, Escape, buscar tecleando), el foco y los
 * roles `listbox`/`option` para lectores de pantalla.
 *
 * Recibe `id` y `aria-describedby` de `Campo`, que así sigue asociando la
 * etiqueta y el hint igual que con un campo nativo.
 */
export function Selector({
  id,
  valor,
  onChange,
  opciones,
  etiqueta,
  placeholder = 'Seleccioná…',
  tituloTabular,
  'aria-describedby': describedBy,
}: {
  id?: string;
  valor: string;
  onChange: (valor: string) => void;
  opciones: OpcionSelector[];
  /** Nombre accesible del campo; normalmente el mismo texto de la etiqueta. */
  etiqueta: string;
  placeholder?: string;
  /** Títulos en cifra tabular — para códigos de equipo, no para nombres. */
  tituloTabular?: boolean;
  'aria-describedby'?: string;
}) {
  const elegida = opciones.find((o) => o.valor === valor);
  const tab = tituloTabular ? 'tabular' : '';
  return (
    <AriaSelect
      id={id}
      aria-label={etiqueta}
      aria-describedby={describedBy}
      placeholder={placeholder}
      selectedKey={elegida ? elegida.valor : null}
      onSelectionChange={(clave) => clave != null && onChange(String(clave))}
      disabledKeys={opciones.filter((o) => o.motivo).map((o) => o.valor)}
      className="group min-w-0"
    >
      <AriaButton
        className={`${INPUT} flex cursor-pointer items-center gap-2 pr-3 text-left outline-none data-[focus-visible]:border-[var(--accent)] data-[focus-visible]:outline-3 data-[focus-visible]:outline-[rgba(29,78,216,.18)] group-data-[open]:border-[var(--accent)]`}
      >
        <SelectValue className="min-w-0 flex-1 truncate">
          {() =>
            elegida ? (
              <>
                <span className={`font-semibold ${tab}`}>{elegida.titulo}</span>
                {elegida.detalle && <span className="text-muted-foreground"> · {elegida.detalle}</span>}
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )
          }
        </SelectValue>
        <ChevronDown
          className="h-5 w-5 shrink-0 text-foreground transition-transform group-data-[open]:rotate-180"
          strokeWidth={2.2}
          aria-hidden
        />
      </AriaButton>
      <Popover
        offset={6}
        className="w-[var(--trigger-width)] min-w-[220px] overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-[0_18px_44px_rgba(20,23,28,.18)] outline-none"
        style={{ maxHeight: 'min(360px, var(--popover-max-height, 360px))' }}
      >
        <ListBox className="flex flex-col gap-0.5 outline-none">
          {opciones.map((o) => (
            <ListBoxItem
              key={o.valor}
              id={o.valor}
              textValue={o.detalle ? `${o.titulo} · ${o.detalle}` : o.titulo}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-1.5 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[focused]:bg-[#f1f3f5] data-[selected]:bg-[var(--accent-soft)] data-[selected]:text-[var(--accent-soft-foreground)]"
            >
              {({ isSelected }) => (
                <>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className={`text-[15.5px] font-semibold ${tab}`}>{o.titulo}</span>
                    {o.detalle && (
                      <span className={`text-[14.5px] ${isSelected ? '' : 'text-muted-foreground'}`}>
                        {' '}
                        · {o.detalle}
                      </span>
                    )}
                    {o.motivo && (
                      <span className="mt-0.5 block text-[12.5px] font-semibold text-[var(--warning-soft-foreground)]">
                        {o.motivo}
                      </span>
                    )}
                  </span>
                  {isSelected && <Check className="h-[18px] w-[18px] shrink-0" strokeWidth={2.6} aria-hidden />}
                </>
              )}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </AriaSelect>
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
/**
 * No se llama `Pick` porque ese es el nombre de un tipo utilitario de
 * TypeScript: la colisión hace que un import faltante falle con un error que
 * no menciona el import, y cuesta media hora encontrarlo.
 */
export function ChipSeleccion({
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
export function Tabla({
  titulo,
  detalle,
  turno,
  children,
}: {
  titulo: ReactNode;
  detalle?: ReactNode;
  /** Pinta el título con la identidad del turno, igual que `SeparadorTurno`.
   *  En escritorio las dos tablas se ven juntas y el color las separa antes
   *  de que haya que leer el encabezado. */
  turno?: Turno;
  children: ReactNode;
}) {
  const estilo = turno ? TURNO_ESTILO[turno] : null;
  const Icono = estilo?.Icono;
  return (
    <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-[0_1px_2px_rgba(20,23,28,.04),0_6px_18px_rgba(20,23,28,.04)]">
      <table className="w-full border-collapse text-sm">
        <caption
          className={`text-left text-sm font-bold ${
            estilo ? 'px-4 py-2.5' : 'px-4 pt-3.5 pb-2.5'
          }`}
          style={estilo ? { background: estilo.fondo, color: estilo.texto } : undefined}
        >
          <span className="flex items-center gap-2">
            {Icono && <Icono className="h-[17px] w-[17px] shrink-0" strokeWidth={2.4} aria-hidden />}
            {titulo}
            {detalle && (
              <span
                className={`ml-auto text-[13px] font-semibold ${estilo ? 'opacity-85' : 'font-normal text-muted-foreground'}`}
              >
                {detalle}
              </span>
            )}
          </span>
        </caption>
        {children}
      </table>
    </div>
  );
}

/**
 * Encabezado de columna. **Sin `whitespace-nowrap` a propósito**: un título
 * largo que no puede cortarse le fija a su columna un ancho mínimo enorme, y
 * entre ocho o nueve columnas eso es lo que empujaba la tabla fuera de la
 * pantalla y obligaba a la barra horizontal. Dejarlo envolver en dos líneas
 * cuesta unos píxeles de alto y devuelve el ancho a los datos.
 */
export const TH =
  'border-b border-border bg-[#fafbfc] px-3 py-2.5 text-left text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase';
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
    <div className="lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-6 xl:grid-cols-[416px_minmax(0,1fr)]">
      <section className="flex flex-col gap-3.5">{formulario}</section>
      <section className="mt-5 flex min-w-0 flex-col gap-3.5 lg:mt-0">{historial}</section>
    </div>
  );
}

/**
 * Una sola columna centrada, para las vistas cuyo historial no vive al lado
 * sino en una ventana aparte. Queda más ancha que la columna de `VistaSplit`
 * porque acá el formulario ya no comparte el ancho con nadie.
 */
export function VistaUnica({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[640px] flex-col gap-3.5">{children}</div>;
}

/* ---------- Ventana modal ---------- */

/**
 * Diálogo del kit de Terreno.
 *
 * Se arma sobre `react-aria-components` —la misma base sobre la que está
 * construido HeroUI— y no sobre HeroUI directo: esta es la primera ventana
 * modal de Terreno, y los estilos por defecto de HeroUI no conocen los
 * tamaños de este kit. De la librería viene justo lo que sale mal cuando se
 * hace a mano: el foco queda atrapado dentro del diálogo, Escape cierra, y el
 * fondo deja de scrollear detrás.
 *
 * En celular y tablet ocupa la pantalla completa —es como se opera en faena,
 * con una mano— y desde `sm` es una ventana centrada.
 */
export function ModalTerreno({
  abierto,
  onAbiertoChange,
  titulo,
  detalle,
  children,
}: {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  titulo: ReactNode;
  detalle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ModalOverlay
      isOpen={abierto}
      onOpenChange={onAbiertoChange}
      isDismissable
      className="fixed inset-0 z-50 flex items-stretch bg-[rgba(20,23,28,.45)] sm:items-center sm:justify-center sm:p-6"
    >
      <Modal className="flex w-full flex-col bg-card sm:max-h-[85vh] sm:max-w-[760px] sm:rounded-3xl sm:border sm:border-border sm:shadow-[0_24px_60px_rgba(20,23,28,.18)]">
        <Dialog className="flex min-h-0 flex-1 flex-col outline-none">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
            <div className="min-w-0">
              <Heading
                slot="title"
                className="text-[17px] leading-tight font-bold tracking-[-0.01em]"
              >
                {titulo}
              </Heading>
              {detalle && <p className="mt-0.5 text-[13px] text-muted-foreground">{detalle}</p>}
            </div>
            {/* 44 px de lado: el mínimo para acertarle con guantes. */}
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => onAbiertoChange(false)}
              className="-mr-1 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-4">
            {children}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/**
 * Pares etiqueta → valor para leer un registro ya cerrado dentro del detalle
 * de un historial. El detalle se lee, no se edita: usar los campos del
 * formulario acá invitaría a escribir sobre algo que ya se mandó.
 *
 * Vive en el kit y no en una vista porque los tres historiales de Terreno
 * —reportes, tarjetas cerradas y trabajos extra— muestran su detalle igual.
 */
export function Filas({ filas }: { filas: [string, ReactNode][] }) {
  return (
    <dl className="m-0 overflow-hidden rounded-2xl border border-border">
      {filas.map(([label, valor]) => (
        <div
          key={label}
          className="flex items-baseline justify-between gap-3 bg-[#fafbfc] px-3 py-2.5 not-first:border-t not-first:border-border"
        >
          <dt className="text-[12.5px] text-muted-foreground">{label}</dt>
          <dd className="m-0 text-right text-[14.5px] font-medium">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
