import { useState } from 'react';
import { Button, Calendar } from '@heroui/react';
import { parseDate } from '@internationalized/date';
import { Dialog, DialogTrigger, Popover } from 'react-aria-components';
import type { DateValue } from 'react-aria-components/Calendar';
import { CalendarDays } from 'lucide-react';

import { toDateOnly } from '../../lib/turno';

/** `YYYY-MM-DD` → el día del calendario; `null` si está vacío o no es una fecha. */
function aDia(fecha: string): DateValue | null {
  try {
    return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? parseDate(fecha) : null;
  } catch {
    return null;
  }
}

/** `YYYY-MM-DD` → `dd/mm/aaaa` para el botón. */
const fmtDia = (fecha: string) => fecha.split('-').reverse().join('/');

/**
 * Fecha de una mantención ya hecha: botón + calendario de HeroUI en un popover
 * (mismo patrón que «Filtrar por fecha» de Cargas), nunca el `<input type="date">`
 * nativo. Los días futuros quedan apagados.
 *
 * Trabaja con `YYYY-MM-DD` (lo que espera el backend); la conversión al
 * `DateValue` de react-aria queda acá adentro. Así una fecha precargada (al
 * editar) abre el calendario en su mes y queda marcada.
 */
export function FechaPasadaPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  /** `YYYY-MM-DD`, o `''` sin fecha. */
  value: string;
  onChange: (fecha: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const dia = aDia(value);
  // Hoy en el reloj del dispositivo (`YYYY-MM-DD`): una mantención ya hecha no puede ser futura (el backend también
  // lo exige).
  const hoy = toDateOnly(new Date());
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <DialogTrigger isOpen={abierto} onOpenChange={setAbierto}>
        <Button className="w-full justify-start" variant="secondary">
          <CalendarDays aria-hidden className="size-[18px]" />
          {value ? fmtDia(value) : 'Elegí la fecha'}
        </Button>
        <Popover
          className="rounded-2xl border border-border bg-card p-2 shadow-[0_18px_44px_rgba(20,23,28,.18)] outline-none"
          offset={6}
        >
          <Dialog aria-label={label} className="outline-none">
            <Calendar<DateValue>
              aria-label={label}
              // Los días futuros quedan apagados: no se pueden elegir.
              isDateUnavailable={(dia) => dia.toString() > hoy}
              onChange={(dia) => {
                onChange(dia.toString());
                // Elegido el día, el popover se cierra solo: queda a la vista en el botón.
                setAbierto(false);
              }}
              value={dia}
            >
              <Calendar.Header>
                <Calendar.NavButton slot="previous" />
                <Calendar.Heading />
                <Calendar.NavButton slot="next" />
              </Calendar.Header>
              <Calendar.Grid>
                <Calendar.GridHeader>
                  {(diaSemana) => <Calendar.HeaderCell>{diaSemana}</Calendar.HeaderCell>}
                </Calendar.GridHeader>
                <Calendar.GridBody>{(dia) => <Calendar.Cell date={dia} />}</Calendar.GridBody>
              </Calendar.Grid>
            </Calendar>
          </Dialog>
        </Popover>
      </DialogTrigger>
    </div>
  );
}
