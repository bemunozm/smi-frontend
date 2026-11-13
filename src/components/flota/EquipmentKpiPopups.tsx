import { KpiDetailModal } from '../dashboard/KpiDetailModal';
import type { RegistroCombustible } from '../../types/combustible';
import type { EquipmentDetail } from '../../types/equipment';
import type { RegistroHorometro } from '../../types/horometro';
import { FuelHistoryTable } from './FuelHistoryTable';
import { UsageHistoryList } from './UsageHistoryList';

/** Popup que abre cada tarjeta KPI de la ficha del equipo. */
export type EquipmentKpiPopupKind = 'usage' | 'maintenance' | 'fuel' | 'extraWorks' | 'findings';

interface PopupBaseProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Historial de horómetro/kilometraje (mismo contenido que la sección inferior). */
export function UsageHistoryPopup({
  equipo,
  registros,
  isOpen,
  onOpenChange,
}: PopupBaseProps & { equipo: EquipmentDetail; registros: RegistroHorometro[] }) {
  return (
    <KpiDetailModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={equipo.equipmentClass === 'LIGHT' ? 'Historial de kilometraje' : 'Historial de horómetro'}
    >
      <UsageHistoryList equipo={equipo} registros={registros} />
    </KpiDetailModal>
  );
}

/** Cargas de combustible, más recientes primero. */
export function FuelHistoryPopup({
  registros,
  isOpen,
  onOpenChange,
  verTodoTo,
}: PopupBaseProps & { registros: RegistroCombustible[]; verTodoTo?: string }) {
  return (
    <KpiDetailModal isOpen={isOpen} onOpenChange={onOpenChange} title="Cargas de combustible" verTodoTo={verTodoTo}>
      <FuelHistoryTable registros={registros} />
    </KpiDetailModal>
  );
}
