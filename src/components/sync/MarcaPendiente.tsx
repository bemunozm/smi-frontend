import type { MarcaPendiente as Marca } from '../../hooks/usePendingWrites';
import { MarcaSinSincronizar } from '../terreno/MarcaSinSincronizar';

/** Badge "Sin sincronizar" de la fila de una entidad que ya existe en el servidor
 * y tiene un cambio guardado en el equipo (`usePendingWrites#marcaDe`). */
export function MarcaPendiente({ marca }: { marca: Marca | null }) {
  if (!marca) return null;
  return <MarcaSinSincronizar edicion requiereAtencion={marca === 'atencion'} />;
}
