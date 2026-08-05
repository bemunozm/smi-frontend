// Campos de formulario con componentes HeroUI v3 (React-Aria) integrados con
// react-hook-form vía Controller. Los HeroUI son controlados (value/onChange),
// no funcionan con register(), por eso se envuelven acá una sola vez.
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form';
import {
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  NumberField,
  Select,
  TextField,
} from '@heroui/react';

interface BaseProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  className?: string;
}

export function FormTextField<T extends FieldValues>({
  control,
  name,
  label,
  className,
  placeholder,
}: BaseProps<T> & { placeholder?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          className={`flex flex-col gap-1 ${className ?? ''}`}
          value={typeof field.value === 'string' ? field.value : ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          isInvalid={!!fieldState.error}
        >
          <Label>{label}</Label>
          <Input placeholder={placeholder} />
          <FieldError>{fieldState.error?.message}</FieldError>
        </TextField>
      )}
    />
  );
}

export function FormNumberField<T extends FieldValues>({
  control,
  name,
  label,
  className,
  minValue,
  step,
}: BaseProps<T> & { minValue?: number; step?: number }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <NumberField
          className={`flex flex-col gap-1 ${className ?? ''}`}
          value={typeof field.value === 'number' ? field.value : NaN}
          onChange={(v) => field.onChange(Number.isNaN(v) ? undefined : v)}
          onBlur={field.onBlur}
          isInvalid={!!fieldState.error}
          minValue={minValue}
          step={step}
        >
          <Label>{label}</Label>
          <NumberField.Group>
            <NumberField.Input />
          </NumberField.Group>
          <FieldError>{fieldState.error?.message}</FieldError>
        </NumberField>
      )}
    />
  );
}

export function FormSelectField<T extends FieldValues>({
  control,
  name,
  label,
  className,
  placeholder = 'Seleccioná…',
  items,
}: BaseProps<T> & { placeholder?: string; items: { value: string; label: string }[] }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Select
          className={`flex flex-col gap-1 ${className ?? ''}`}
          placeholder={placeholder}
          selectedKey={field.value ? String(field.value) : null}
          onSelectionChange={(key) => field.onChange(key == null ? '' : String(key))}
          onBlur={field.onBlur}
          isInvalid={!!fieldState.error}
        >
          <Label>{label}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {items.map((it) => (
                <ListBoxItem key={it.value} id={it.value}>
                  {it.label}
                </ListBoxItem>
              ))}
            </ListBox>
          </Select.Popover>
          <FieldError>{fieldState.error?.message}</FieldError>
        </Select>
      )}
    />
  );
}
