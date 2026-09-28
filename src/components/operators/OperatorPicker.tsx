import type { Key } from '@heroui/react';
import { ComboBox, FieldError, Input, Label, ListBox } from '@heroui/react';

import { useOperators } from '../../hooks/useOperators';

/** Forma mínima de operador que necesita este picker (y todos sus
 * llamadores hoy) — ni el `Operator` completo del catálogo (rut/isActive/
 * fechas) ni el snapshot de nombre que arma cada form al guardar. */
export interface OperatorOption {
  id: string;
  name: string;
}

export interface OperatorPickerProps {
  /** `operatorId` seleccionado, o `null` si no hay ninguno. Controlado. */
  value: string | null;
  /** Entrega el operador completo (o `null`) en vez de solo el id — así el
   * llamador puede guardar tanto `operatorId` como el nombre-snapshot
   * (`operador`, ver `RegistrarEntradaModal`) sin tener que volver a buscarlo
   * en la lista. */
  onChange: (operator: OperatorOption | null) => void;
  label?: string;
  placeholder?: string;
  isInvalid?: boolean;
  isDisabled?: boolean;
  errorMessage?: string;
  fullWidth?: boolean;
  /**
   * Operador ASIGNADO hoy al equipo/tarjeta que se está editando — se
   * inyecta como opción del picker aunque `useOperators({ isActive: true })`
   * (solo activos) no lo traiga. Sin esto, abrir el form de un equipo cuyo
   * operador pasó a inactivo lo mostraría "sin seleccionar", y guardar sin
   * tocar el campo lo desasignaría en silencio (ver anexo "el operador deja
   * de ser usuario de la plataforma", Fase 2 front — pickers de Flota).
   * `null`/`undefined` = no hay asignación actual, no agrega nada.
   */
  currentAssignee?: OperatorOption | null;
  /**
   * Agrega una opción "Sin operador asignado" al principio de la lista que
   * llama a `onChange(null)` — mismo patrón que `SIN_ASIGNAR`/`SIN_SUCURSAL`
   * en `CamposEquipo` (`EquipoEditDelete.tsx`), pero como item real del
   * picker en vez de un sentinel de string, para que siga siendo una sola
   * fuente con el resto de la lista. Los pickers de asignación de Flota
   * (`CamposEquipo`/`AsignacionForm`) lo activan; el Módulo A
   * (`RegistrarEntradaModal`) NO lo pasa — ahí el operador es obligatorio.
   * Default `false`.
   */
  allowsUnassign?: boolean;
}

/** Sentinel del item "Sin operador asignado" (`allowsUnassign`) — nunca
 * choca con un id real de operador (los ids del catálogo son cuid/uuid del
 * backend), así que sirve para distinguirlo de un operador de verdad en
 * `handleSelectionChange`. */
const UNASSIGN_KEY = '__sin_operador_asignado__';

/**
 * Selector reusable de Operador (catálogo propio, ver `types/operator.ts`) —
 * `ComboBox` buscable de HeroUI, solo operadores ACTIVOS
 * (`useOperators({ isActive: true })`, mismo criterio que cualquier picker de
 * catálogo en la app, p. ej. `useBranches({ isActive: true })`). Lo consumen
 * el Módulo A (`RegistroEquipoView`), el modal de entrada de Flota
 * (`RegistrarEntradaModal`) y los pickers de asignación de Flota
 * (`CamposEquipo`/`AsignacionForm`, ver `currentAssignee`).
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
  currentAssignee = null,
  allowsUnassign = false,
}: OperatorPickerProps) {
  const { data: operators = [], isPending } = useOperators({ isActive: true });

  // Mismo criterio que `opcionesSucursal` en `CamposEquipo` (sucursal base
  // homed a una que pasó a inactiva): si el asignado actual no está entre
  // los activos, se agrega igual — si no, el picker quedaría "en blanco"
  // aunque el campo sí tenga valor, y guardar así lo desasignaría solo.
  const currentAssigneeInactivo =
    currentAssignee != null && !operators.some((operator) => operator.id === currentAssignee.id);
  const opciones: OperatorOption[] = currentAssigneeInactivo ? [...operators, currentAssignee] : operators;
  const byId = new Map(opciones.map((operator) => [operator.id, operator]));

  // El `ComboBox` es controlado (`selectedKey`) — cuando no hay operador
  // (`value === null`) pero SÍ hay opción de "Sin asignar", su `selectedKey`
  // real tiene que ser `UNASSIGN_KEY` (el id del item que el usuario
  // efectivamente clickeó), no `null` a secas: si el prop controlado no
  // calza con lo que el usuario acaba de elegir, React Aria interpreta que
  // la selección se invalidó "desde afuera" y puede dejar el popover
  // abierto en vez de cerrarlo después de elegir. `onChange` sigue
  // reportando `null` al llamador (ver `handleSelectionChange`) — este
  // mapeo es un detalle interno del `ComboBox`, no cambia el contrato.
  const selectedKey = value ?? (allowsUnassign ? UNASSIGN_KEY : null);

  const handleSelectionChange = (key: Key | null) => {
    if (key == null || String(key) === UNASSIGN_KEY) {
      onChange(null);
      return;
    }
    onChange(byId.get(String(key)) ?? null);
  };

  return (
    <ComboBox
      fullWidth={fullWidth}
      isDisabled={isDisabled || isPending}
      isInvalid={isInvalid}
      selectedKey={selectedKey}
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
          {allowsUnassign ? (
            <ListBox.Item id={UNASSIGN_KEY} textValue="Sin operador asignado">
              Sin operador asignado
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ) : null}
          {opciones.map((operator) => (
            <ListBox.Item id={operator.id} key={operator.id} textValue={operator.name}>
              {operator.name}
              {currentAssigneeInactivo && operator.id === currentAssignee?.id ? (
                <span className="text-(--muted)"> (inactivo)</span>
              ) : null}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </ComboBox>
  );
}
