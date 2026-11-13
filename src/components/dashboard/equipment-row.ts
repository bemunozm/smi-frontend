/** Fila navegable a la ficha del equipo (`onAction` de react-aria: clic y Enter; Espacio queda reservado a selección en el patrón de grilla de react-aria). */
const NAVIGABLE_ROW_CLASS = 'cursor-pointer hover:bg-surface-secondary';

/** Props de una fila de tabla que lleva a `/equipos/:id`; sin id (payload cacheado) no es navegable.
 * `from: '/'` deja que la ficha vuelva al dashboard en vez de a la lista. */
export function rowToEquipment(
  equipmentId: string | undefined,
  navigate: (to: string, opts?: { state?: { from: string } }) => void,
) {
  return equipmentId
    ? { className: NAVIGABLE_ROW_CLASS, onAction: () => navigate(`/equipos/${equipmentId}`, { state: { from: '/' } }) }
    : {};
}
