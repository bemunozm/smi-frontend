import { useState, type ReactNode } from 'react';
import { FieldError, Input, Label, TextField } from '@heroui/react';

import { avisoDeAgrupacion, formatDecimalInput, parseDecimal, parseInteger } from '../lib/decimal';

export interface DecimalFieldProps {
  label: string;
  /** Algo al lado de la etiqueta (un chip de estado). */
  labelAddon?: ReactNode;
  /** `NaN` cuando el campo está vacío o no es un número. */
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  isInvalid?: boolean;
  errorMessage?: ReactNode;
  /** Advertencia que no impide guardar (p. ej. "menor que la última lectura"). */
  warning?: ReactNode;
  isDisabled?: boolean;
  placeholder?: string;
  className?: string;
  /**
   * Lee un entero con separador de miles (`1.200` → 1200) en vez de un decimal.
   * Usar `IntegerField`, que lo fija.
   */
  entero?: boolean;
}

/**
 * Campo numérico de un formulario. Lee el texto con `parseDecimal`: un `.` o una
 * `,` sueltos son el separador decimal, nunca de miles — el `NumberField` de
 * react-aria sigue el idioma del equipo y en es-CL toma el punto como separador
 * de miles (`12.5` → 125). Entrega un `number` (`NaN` si está vacío o no es un
 * número, como el `NumberField`), así que se conecta igual a un `Controller` de
 * react-hook-form.
 *
 * Con `entero` (ver `IntegerField`) lee con `parseInteger`: no hay decimal, así
 * que el aviso de agrupación no aplica.
 */
export function DecimalField({
  label,
  labelAddon,
  value,
  onChange,
  onBlur,
  isInvalid,
  errorMessage,
  warning,
  isDisabled,
  placeholder,
  className,
  entero = false,
}: DecimalFieldProps) {
  const leer = entero ? parseInteger : parseDecimal;
  const escribirValor = (numero: number | null | undefined) => formatDecimalInput(numero, entero ? 0 : 2);

  const [texto, setTexto] = useState(() => escribirValor(value));
  const [valorVisto, setValorVisto] = useState(value);

  // El formulario cambió el valor por su cuenta (un reset, la lectura del OCR): el
  // texto lo sigue. Mientras la persona escribe, el valor que ella misma produjo
  // coincide con `valorVisto` y el texto no se toca.
  if (!Object.is(value, valorVisto)) {
    setValorVisto(value);
    const actual = leer(texto) ?? Number.NaN;
    if (!Object.is(actual, value)) setTexto(escribirValor(value));
  }

  const escribir = (nuevo: string) => {
    const numero = leer(nuevo) ?? Number.NaN;
    setTexto(nuevo);
    setValorVisto(numero);
    onChange(numero);
  };

  return (
    <TextField className={className} fullWidth isDisabled={isDisabled} isInvalid={isInvalid} onChange={escribir} value={texto}>
      {labelAddon ? (
        <div className="flex flex-wrap items-center gap-2">
          <Label>{label}</Label>
          {labelAddon}
        </div>
      ) : (
        <Label>{label}</Label>
      )}
      <Input
        inputMode={entero ? 'numeric' : 'decimal'}
        onBlur={onBlur}
        onFocus={(event) => event.currentTarget.select()}
        placeholder={placeholder}
      />
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
      {[warning, entero ? null : avisoDeAgrupacion(texto)].map((aviso, i) =>
        aviso ? (
          <p className="m-0 text-xs text-warning-soft-foreground" key={i} role="status">
            {aviso}
          </p>
        ) : null,
      )}
    </TextField>
  );
}
