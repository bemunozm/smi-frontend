import { useState, type ReactNode } from 'react';
import { FieldError, Input, Label, TextField } from '@heroui/react';

import { formatDecimalInput, parseDecimal } from '../lib/decimal';

interface DecimalFieldProps {
  label: string;
  /** Algo al lado de la etiqueta (un chip de estado). */
  labelAddon?: ReactNode;
  /** `NaN` cuando el campo está vacío o no es un número. */
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  isInvalid?: boolean;
  errorMessage?: ReactNode;
  isDisabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Campo numérico con decimales de un formulario. Lee el texto con `parseDecimal`:
 * un `.` o una `,` sueltos son el separador decimal, nunca de miles — el
 * `NumberField` de react-aria sigue el idioma del equipo y en es-CL toma el punto
 * como separador de miles (`12.5` → 125). Entrega un `number` (`NaN` si está vacío
 * o no es un número, como el `NumberField`), así que se conecta igual a un
 * `Controller` de react-hook-form.
 */
export function DecimalField({
  label,
  labelAddon,
  value,
  onChange,
  onBlur,
  isInvalid,
  errorMessage,
  isDisabled,
  placeholder,
  className,
}: DecimalFieldProps) {
  const [texto, setTexto] = useState(() => formatDecimalInput(value));
  const [valorVisto, setValorVisto] = useState(value);

  // El formulario cambió el valor por su cuenta (un reset, la lectura del OCR): el
  // texto lo sigue. Mientras la persona escribe, el valor que ella misma produjo
  // coincide con `valorVisto` y el texto no se toca.
  if (!Object.is(value, valorVisto)) {
    setValorVisto(value);
    const actual = parseDecimal(texto) ?? Number.NaN;
    if (!Object.is(actual, value)) setTexto(formatDecimalInput(value));
  }

  const escribir = (nuevo: string) => {
    const numero = parseDecimal(nuevo) ?? Number.NaN;
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
        inputMode="decimal"
        onBlur={onBlur}
        onFocus={(event) => event.currentTarget.select()}
        placeholder={placeholder}
      />
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </TextField>
  );
}
