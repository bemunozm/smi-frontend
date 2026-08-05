// Controles de UI themed (usan los tokens de tema de index.css).
// Nota: se pueden reemplazar por componentes de HeroUI v3 cuando el equipo
// estandarice su API compositiva (React Aria). @heroui/styles ya está importado.
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { forwardRef } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' };

export function Button({ children, className = '', variant = 'primary', ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-primary text-primary-foreground hover:opacity-90'
      : 'border border-border hover:bg-muted';
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

function FieldWrap({
  label,
  error,
  children,
  className = '',
}: {
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="text-muted-foreground">{label}</span>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  wrapClassName?: string;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, wrapClassName, ...props }, ref) => (
    <FieldWrap label={label} error={error} className={wrapClassName}>
      <input ref={ref} className="rounded-lg border border-border bg-background p-2" {...props} />
    </FieldWrap>
  ),
);
TextField.displayName = 'TextField';

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  children: ReactNode;
  wrapClassName?: string;
};

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, children, wrapClassName, ...props }, ref) => (
    <FieldWrap label={label} error={error} className={wrapClassName}>
      <select ref={ref} className="rounded-lg border border-border bg-background p-2" {...props}>
        {children}
      </select>
    </FieldWrap>
  ),
);
SelectField.displayName = 'SelectField';
