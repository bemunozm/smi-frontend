import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Spinner } from '@heroui/react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useCalendarioVencimientos } from '../../hooks/useVencimientos';
import { ROLES } from '../../types/roles';
import { mesLargo, mover } from '../../lib/meses';
import { ChipMantencion, Leyenda, ListaVencimientos } from './calendario';

/**
 * Módulo 4 · R21 — el calendario de vencimientos DENTRO de la ficha del
 * liviano: los próximos 12 meses de sus documentos y su próxima mantención por
 * km. Solo en los livianos, y para el administrador y el mantenedor (los que
 * reciben los avisos). La vista de todas las patentes se abre desde el botón.
 */
export function CalendarioVencimientosCard({
  equipo,
  base,
}: {
  equipo: { id: string; equipmentClass: string };
  /** `/equipos` o `/mantenimiento/equipos`. */
  base: string;
}) {
  const { role } = useCurrentUser();
  const puedeVer = role === ROLES.ADMIN || role === ROLES.MANTENEDOR;
  const esLiviano = equipo.equipmentClass === 'LIGHT';
  const [desde, setDesde] = useState<string | undefined>(undefined);
  const { data, isLoading, isError } = useCalendarioVencimientos(desde, equipo.id, puedeVer && esLiviano);
  if (!puedeVer || !esLiviano) return null;

  const vehiculo = data?.equipment[0];
  const inicio = data?.months[0];

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Card.Title>Calendario de vencimientos</Card.Title>
            <Card.Description>
              Los próximos 12 meses: revisión técnica, permiso, seguro y la mantención de cada 10.000 km.
            </Card.Description>
          </div>
          <Link
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-default px-3 text-sm font-medium text-default-foreground hover:bg-default-hover"
            to={`${base}/vencimientos`}
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            Ver todos los livianos
          </Link>
        </div>
      </Card.Header>
      <Card.Content className="mt-1 flex flex-col gap-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : isError || !data || !vehiculo ? (
          <p className="text-sm text-danger">No se pudo cargar el calendario de este equipo.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                aria-label="12 meses antes"
                isIconOnly
                size="sm"
                variant="secondary"
                onPress={() => inicio && setDesde(mover(inicio, -12))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-[15px] font-semibold">
                {mesLargo(data.months[0])} – {mesLargo(data.months[11])}
              </span>
              <Button
                aria-label="12 meses después"
                isIconOnly
                size="sm"
                variant="secondary"
                onPress={() => inicio && setDesde(mover(inicio, 12))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {desde ? (
                <Button size="sm" variant="secondary" onPress={() => setDesde(undefined)}>
                  Volver a hoy
                </Button>
              ) : null}
              <span className="ml-auto">
                <ChipMantencion s={vehiculo.service} />
              </span>
            </div>
            <ListaVencimientos equipo={vehiculo} months={data.months} />
            <Leyenda conDia={false} />
          </>
        )}
      </Card.Content>
    </Card>
  );
}
