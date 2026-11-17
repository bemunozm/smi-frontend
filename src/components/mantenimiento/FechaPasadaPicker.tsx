import { useState } from 'react';
import { Button, Calendar } from '@heroui/react';
import { Dialog, DialogTrigger, Popover } from 'react-aria-components';
import type { DateValue } from 'react-aria-components/Calendar';
import { CalendarDays } from 'lucide-react';

import { toDateOnly } from '../../lib/turno';

/** `YYYY-MM-DD` → `dd/mm/aaaa` para el botón. */
const fmtDia = (fecha: string) => fecha.split('-').reverse().join('/');

/**
 * Fecha de una mantención ya hecha: botón + calendario de HeroUI en un popover
 * (mismo patrón que «Filtrar por fecha» de Cargas), nunca el `<input type="date">`
 * nativo. Los días futuros quedan apagados.
 *
 * Trabaja con `YYYY-MM-DD` (lo que espera el backend), no con el `DateValue` de
 * react-aria: armar uno desde un texto pide `@internationalized/date`, que no es
 * dependencia directa del proyecto. Por eso una fecha que llega precargada se ve
 * en el botón pero no queda marcada en el calendario (que abre en el mes de hoy)
 * hasta que se elige un día.
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
  // El último día elegido en el calendario: se marca mientras siga siendo el valor.
  const [elegido, setElegido] = useState<DateValue | null>(null);
  const marcado = elegido != null && elegido.toString() === value ? elegido : null;
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
                setElegido(dia);
                onChange(dia.toString());
                // Elegido el día, el popover se cierra solo: queda a la vista en el botón.
                setAbierto(false);
              }}
              value={marcado}
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
