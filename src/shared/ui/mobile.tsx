// Kit de UI mobile para "SMI · Operación en Terreno" (según el mockup).
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { forwardRef, useRef, useState } from 'react';
import { Camera, ImageIcon, X } from 'lucide-react';
import { uploadImage, assetUrl } from '../api/uploads';

/* ---------- Chip ---------- */
export type ChipTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'danger-solid';

const chipTones: Record<ChipTone, string> = {
  neutral: 'bg-[var(--default)] text-[var(--default-foreground)]',
  info: 'bg-[var(--accent-soft)] text-[var(--accent-soft-foreground)]',
  success: 'bg-[var(--success-soft)] text-[var(--success-soft-foreground)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning-soft-foreground)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger-soft-foreground)]',
  'danger-solid': 'bg-[var(--danger)] text-white',
};

export function Chip({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase ${chipTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ---------- Label ---------- */
export function FieldLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">{children}</span>
      {hint != null && <span className="text-[11px] font-semibold">{hint}</span>}
    </div>
  );
}

/* ---------- Card ---------- */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)] ${className}`}>
      {children}
    </div>
  );
}

/* ---------- SectionHeader ---------- */
export function SectionHeader({ children, action = 'Ver todos' }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-7 mb-3 flex items-center justify-between">
      <h2 className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">{children}</h2>
      {action != null && <span className="text-xs font-bold text-primary">{action}</span>}
    </div>
  );
}

/* ---------- Field (input con unidad / prefijo / adorno) ---------- */
type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: ReactNode;
  unit?: string;
  prefix?: string;
  right?: ReactNode;
  error?: string;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, unit, prefix, right, error, className, ...props },
  ref,
) {
  return (
    <div>
      {label && <FieldLabel hint={hint}>{label}</FieldLabel>}
      <div
        className={`flex items-center gap-2 rounded-xl border bg-[var(--field-background)] px-3 transition focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/15 ${
          error ? 'border-[var(--danger)]' : 'border-border'
        }`}
      >
        {prefix && <span className="text-xs font-bold text-muted-foreground">{prefix}</span>}
        <input
          ref={ref}
          className={`min-w-0 flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-[var(--field-placeholder)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${className ?? ''}`}
          {...props}
        />
        {unit && <span className="text-xs font-medium text-muted-foreground">{unit}</span>}
        {right}
      </div>
      {error && <p className="mt-1 text-xs font-medium text-[var(--danger)]">{error}</p>}
    </div>
  );
});

/* ---------- Select (estilizado como Field) ---------- */
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: ReactNode;
  error?: string;
  left?: ReactNode;
  right?: ReactNode;
};

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
  { label, hint, error, left, right, className, children, ...props },
  ref,
) {
  return (
    <div>
      {label && <FieldLabel hint={hint}>{label}</FieldLabel>}
      <div
        className={`flex items-center gap-2 rounded-xl border bg-[var(--field-background)] px-3 transition focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/15 ${
          error ? 'border-[var(--danger)]' : 'border-border'
        }`}
      >
        {left}
        <select
          ref={ref}
          className={`min-w-0 flex-1 appearance-none bg-transparent py-2.5 text-sm text-foreground outline-none ${className ?? ''}`}
          {...props}
        >
          {children}
        </select>
        {right}
      </div>
      {error && <p className="mt-1 text-xs font-medium text-[var(--danger)]">{error}</p>}
    </div>
  );
});

/* ---------- Textarea ---------- */
type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: ReactNode; error?: string };

export const TextareaField = forwardRef<HTMLTextAreaElement, AreaProps>(function TextareaField(
  { label, hint, error, className, ...props },
  ref,
) {
  return (
    <div>
      {label && <FieldLabel hint={hint}>{label}</FieldLabel>}
      <textarea
        ref={ref}
        className={`w-full rounded-xl border bg-[var(--field-background)] px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-[var(--field-placeholder)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 ${
          error ? 'border-[var(--danger)]' : 'border-border'
        } ${className ?? ''}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs font-medium text-[var(--danger)]">{error}</p>}
    </div>
  );
});

/* ---------- Segmented (turno) ---------- */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; sub?: string }[];
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            type="button"
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-xl border px-2 py-2 text-center transition ${
              active
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-soft-foreground)]'
                : 'border-border bg-card text-foreground hover:bg-[var(--surface-hover)]'
            }`}
          >
            <div className="text-sm font-bold">{o.label}</div>
            {o.sub && <div className="text-[10px] font-medium text-muted-foreground">{o.sub}</div>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- StatRow (caja de cálculo) ---------- */
export function StatRow({
  items,
  className = '',
}: {
  items: { label: string; value: ReactNode; tone?: 'primary' | 'default' }[];
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-2 gap-3 rounded-2xl bg-[var(--surface-tertiary)] p-3.5 ${className}`}>
      {items.map((it, i) => (
        <div key={i}>
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{it.label}</div>
          <div className={`tabular mt-0.5 text-xl font-semibold ${it.tone === 'primary' ? 'text-primary' : 'text-foreground'}`}>
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- PrimaryButton ---------- */
export function PrimaryButton({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-[0_2px_6px_rgba(30,80,234,0.25)] transition hover:bg-[var(--accent-hover)] active:scale-[0.99] disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ initials }: { initials: string }) {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-bold text-[var(--accent-soft-foreground)]">
      {initials}
    </div>
  );
}

/* ---------- Foto: dropzone y botones (subida real) ---------- */
function useUpload(onChange: (url: string | undefined) => void) {
  const [uploading, setUploading] = useState(false);
  const handle = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadImage(file));
    } catch {
      /* noop */
    } finally {
      setUploading(false);
    }
  };
  return { uploading, handle };
}

export function PhotoDropzone({
  value,
  onChange,
  title,
  subtitle,
}: {
  value?: string;
  onChange: (url: string | undefined) => void;
  title: string;
  subtitle?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploading, handle } = useUpload(onChange);
  const preview = assetUrl(value);

  if (preview) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border">
        <img src={preview} alt="Foto" className="h-40 w-full object-cover" />
        <button
          type="button"
          onClick={() => {
            onChange(undefined);
            if (inputRef.current) inputRef.current.value = '';
          }}
          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
          aria-label="Quitar foto"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[var(--accent)]/40 bg-[var(--accent-soft)]/60 px-4 py-6 text-center transition hover:bg-[var(--accent-soft)]"
    >
      <Camera className="h-6 w-6 text-[var(--accent)]" />
      <span className="text-sm font-semibold text-[var(--accent-soft-foreground)]">
        {uploading ? 'Subiendo…' : title}
      </span>
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
    </button>
  );
}

export function PhotoButtons({
  value,
  onChange,
}: {
  value?: string;
  onChange: (url: string | undefined) => void;
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const { uploading, handle } = useUpload(onChange);
  const preview = assetUrl(value);

  if (preview) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border">
        <img src={preview} alt="Foto" className="h-36 w-full object-cover" />
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
          aria-label="Quitar foto"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const box = 'flex flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border py-5 text-center transition hover:bg-[var(--surface-hover)]';
  return (
    <div className="flex gap-3">
      <button type="button" onClick={() => camRef.current?.click()} className={box}>
        <Camera className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">{uploading ? 'Subiendo…' : 'Tomar foto'}</span>
      </button>
      <button type="button" onClick={() => galRef.current?.click()} className={box}>
        <ImageIcon className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">Desde galería</span>
      </button>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
    </div>
  );
}

/* ---------- ListCard (contenedor de item de lista) ---------- */
export function ListCard({
  children,
  accent,
  className = '',
}: {
  children: ReactNode;
  accent?: string; // color del borde izquierdo
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-card)] ${className}`}
      style={accent ? { borderLeft: `4px solid ${accent}` } : undefined}
    >
      {children}
    </div>
  );
}

/* ---------- Título de pantalla ---------- */
export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
