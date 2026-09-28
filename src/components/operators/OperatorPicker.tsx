import type { Key } from '@heroui/react';
import { ComboBox, FieldError, Input, Label, ListBox } from '@heroui/react';

import { useOperators } from '../../hooks/useOperators';
import type { Operator } from '../../types/operator';

export interface OperatorPickerProps {
  /** `operatorId` seleccionado, o `null` si no hay ninguno. Controlado. */
  value: string | null;
  /** Entrega el `Operator` completo (o `null`) en vez de solo el id — así el
   * llamador puede guardar tanto `operatorId` como el nombre-snapshot
   * (`operador`, ver `RegistrarEntradaModal`) sin tener que volver a buscarlo
   * en la lista. */
  onChange: (operator: Operator | null) => void;
  label?: string;
  placeholder?: string;
  isInvalid?: boolean;
  isDisabled?: boolean;
  errorMessage?: string;
  fullWidth?: boolean;
}

/**
 * Selector reusable de Operador (catálogo propio, ver `types/operator.ts`) —
 * `ComboBox` buscable de HeroUI, solo operadores ACTIVOS
 * (`useOperators({ isActive: true })`, mismo criterio que cualquier picker de
 * catálogo en la app, p. ej. `useBranches({ isActive: true })`). Lo consumen
 * el Módulo A (`RegistroEquipoView`, próxima fase) y el modal de entrada de
 * Flota (`RegistrarEntradaModal`).
 */
export function OperatorPicker({
  value,
  onChange,
  label = 'Operador',
  placeholder = 'Buscar operador…',
  isInvalid,
  isDisabled,
  errorMessage,
  fullWidth = true,
}: OperatorPickerProps) {
  const { data: operators = [], isPending } = useOperators({ isActive: true });
  const byId = new Map(operators.map((operator) => [operator.id, operator]));

  const handleSelectionChange = (key: Key | null) => {
    onChange(key == null ? null : (byId.get(String(key)) ?? null));
  };

  return (
    <ComboBox
      fullWidth={fullWidth}
      isDisabled={isDisabled || isPending}
      isInvalid={isInvalid}
      selectedKey={value}
      onSelectionChange={handleSelectionChange}
    >
      <Label>{label}</Label>
      <ComboBox.InputGroup>
        <Input placeholder={placeholder} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox
          renderEmptyState={() => (
            <div className="p-3 text-sm text-muted-foreground">Sin operadores activos</div>
          )}
        >
          {operators.map((operator) => (
            <ListBox.Item id={operator.id} key={operator.id} textValue={operator.name}>
              {operator.name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </ComboBox>
  );
}
