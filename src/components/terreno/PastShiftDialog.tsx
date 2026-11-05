import { useState } from 'react';

import { usePastShiftSummary } from '../../hooks/usePastShiftSummary';
import { useTurnoActual } from '../../hooks/useTurnoActual';
import { esTurnoPasado, fromDateOnly, toDateOnly, type Turno } from '../../lib/turno';
import { Boton, Campo, Form, Hint, Input, Label, ModalTerreno, Segmentado } from './ui';

/**
 * Diálogo del modo "registrar un turno pasado" (carga histórica): fecha +
 * turno dentro de los últimos 30 días (la ventana que valida el backend),
 * nunca el turno vigente — ese se registra en el modo normal.
 *
 * Antes de confirmar muestra lo que ese turno YA tiene registrado
 * (`usePastShiftSummary`): "mis tarjetas" solo baja lo cerrado en las
 * últimas 48 h, así que sin este aviso un turno backfilleado hace una
 * semana se vería vacío y se podría duplicar. Sin señal el aviso no
 * aparece (limitación documentada en el diseño).
 */
export function PastShiftDialog({
  abierto,
  onAbiertoChange,
  onConfirmar,
}: {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  /** Recibe un par ya validado como turno pasado. */
  onConfirmar: (fecha: Date, turno: Turno) => void;
}) {
  const reloj = useTurnoActual();
  const hoy = toDateOnly(new Date());
  // Ayer y DIURNO: el par pasado más probable durante una inducción.
  const [fecha, setFecha] = useState(() => toDateOnly(new Date(Date.now() - 86_400_000)));
  const [turno, setTurno] = useState<Turno>('DIURNO');

  const valida = fecha !== '' && esTurnoPasado(fromDateOnly(fecha), turno, reloj);
  const { data: turnos } = usePastShiftSummary(
    abierto && valida ? { fecha: fromDateOnly(fecha), turno } : null,
  );
  const tarjetas = (turnos ?? []).flatMap((t) => t.cards);
  const reporteEnviado = (turnos ?? []).some((t) => t.exitReports.length > 0);

  return (
    <ModalTerreno
      abierto={abierto}
      onAbiertoChange={onAbiertoChange}
      titulo="Registrar un turno pasado"
      detalle="Hasta 30 días hacia atrás · los datos quedan fechados en ese día"
    >
      <Form>
        <Campo label="Fecha del turno">
          <Input
            type="date"
            aria-label="Fecha del turno pasado"
            min={toDateOnly(new Date(Date.now() - 30 * 86_400_000))}
            max={hoy}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </Campo>

        <div className="flex flex-col gap-1.5">
          <Label>Turno</Label>
          <Segmentado
            etiqueta="Turno pasado"
            valor={turno}
            onChange={setTurno}
            opciones={[
              { valor: 'DIURNO', label: 'DIURNO', sub: '08–20' },
              { valor: 'NOCTURNO', label: 'NOCTURNO', sub: '20–08' },
            ]}
          />
          {turno === 'NOCTURNO' && (
            <Hint>
              El NOCTURNO del {fecha ? fromDateOnly(fecha).toLocaleDateString('es-CL') : '—'} es
              el que empezó a las 20:00 de ese día.
            </Hint>
          )}
        </div>

        {!valida && fecha !== '' && (
          <Hint>Ese turno todavía no termina: regístralo en el modo normal.</Hint>
        )}

        {tarjetas.length > 0 && (
          <div className="rounded-2xl bg-[var(--accent-soft)] p-3 text-sm text-[var(--accent-soft-foreground)]">
            <b>Este turno ya tiene tarjetas registradas:</b>{' '}
            {tarjetas.map((t) => t.equipo.internalCode).join(', ')}.
            {reporteEnviado && (
              <>
                {' '}
                <b>Reporte de salida ya enviado.</b>
              </>
            )}
            <span className="mt-1 block">
              Revisa antes de volver a cargar esos equipos: se duplicarían.
            </span>
          </div>
        )}

        <Boton
          ancho
          disabled={!valida}
          onClick={() => {
            onConfirmar(fromDateOnly(fecha), turno);
            onAbiertoChange(false);
          }}
        >
          Registrar este turno
        </Boton>
      </Form>
    </ModalTerreno>
  );
}
