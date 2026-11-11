import { ArrowRight, Plus, X } from 'lucide-react';

import { FotoRespaldoField } from '../flota/FotoRespaldoField';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { usePastShiftQuickEntry } from '../../hooks/usePastShiftQuickEntry';
import type { ContextoTurno } from '../../lib/turno';
import type { Equipment } from '../../types/equipment';
import { opcionesOperador } from '../../lib/operadores-habituales';
import type { Operator } from '../../types/operator';
import { Boton, Card, CardHead, Campo, Form, Hint, Input, Selector } from './ui';

/**
 * Carga rápida del turno pasado: la planilla de papel en pantalla — una fila
 * por equipo (operador, horómetro inicial/final, litros) que al guardar
 * encola la apertura y el cierre de cada tarjeta en el turno elegido. Cada
 * cierre lleva la foto del combustible de su fila (obligatoria).
 */
export function PastShiftQuickEntry({
  ctx,
  disponibles,
  operadores,
}: {
  ctx: ContextoTurno;
  disponibles: Equipment[];
  operadores: Operator[];
}) {
  const { user } = useCurrentUser();
  const q = usePastShiftQuickEntry({ ctx, disponibles, userId: user?.id });

  return (
    <Card>
      <CardHead
        titulo="Carga rápida del turno"
        bajada="La planilla en una tabla: una fila por equipo, se abre y cierra todo de una vez."
      />
      <Form>
        {q.filas.map((fila, i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-2xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
                Fila {i + 1}
              </span>
              <button
                type="button"
                aria-label={`Quitar fila ${i + 1}`}
                onClick={() => q.quitarFila(i)}
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl bg-[#eef0f2]"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <Campo label="Equipo">
              <Selector
                etiqueta={`Equipo de la fila ${i + 1}`}
                tituloTabular
                valor={fila.equipoId}
                onChange={(equipoId) => q.setFila(i, { equipoId })}
                opciones={q.equiposDeFila(i).map((e) => ({
                  valor: e.id,
                  titulo: e.internalCode,
                  detalle: e.type,
                }))}
              />
            </Campo>

            <Campo label="Operador">
              <Selector
                etiqueta={`Operador de la fila ${i + 1}`}
                valor={fila.operatorId}
                onChange={(operatorId) => q.setFila(i, { operatorId })}
                opciones={opcionesOperador(operadores, user?.id)}
              />
            </Campo>

            <div className="grid grid-cols-3 gap-2.5">
              <Campo label="H. inicial">
                <Input
                  numerico
                  aria-label={`Horómetro inicial de la fila ${i + 1}`}
                  value={fila.inicial}
                  className="!pr-3.5"
                  onChange={(e) => q.setFila(i, { inicial: e.target.value })}
                />
              </Campo>
              <Campo label="H. final">
                <Input
                  numerico
                  aria-label={`Horómetro final de la fila ${i + 1}`}
                  value={fila.final}
                  className="!pr-3.5"
                  onChange={(e) => q.setFila(i, { final: e.target.value })}
                />
              </Campo>
              <Campo label="Litros">
                <Input
                  numerico
                  aria-label={`Litros de la fila ${i + 1}`}
                  value={fila.litros}
                  className="!pr-3.5"
                  onChange={(e) => q.setFila(i, { litros: e.target.value })}
                />
              </Campo>
            </div>

            {/* La evidencia de la carga, igual que en el cierre normal:
                obligatoria en toda fila (la validación del hook bloquea el
                guardado sin ella). */}
            <FotoRespaldoField
              file={fila.foto}
              isReadingPhoto={false}
              captureDate={null}
              onSelect={(foto) => q.setFila(i, { foto })}
              onClear={() => q.setFila(i, { foto: null })}
              title="Foto del combustible"
              subtitle="Del surtidor o la boleta de esa carga"
              staleQuestion="¿es la de esa carga?"
              guia="De la galería del teléfono («Elegir de la galería»): la foto que se tomó ese día al cargar."
            />

            {q.errorDeFila(i) && <Hint>{q.errorDeFila(i)}</Hint>}
          </div>
        ))}

        <Boton variante="contorno" onClick={q.agregarFila}>
          <Plus className="h-[18px] w-[18px]" aria-hidden /> Agregar fila
        </Boton>

        <Boton ancho disabled={!q.puedeGuardar || q.isGuardando} onClick={() => void q.guardar()}>
          {q.isGuardando ? 'Guardando…' : 'Guardar tarjetas del turno'}{' '}
          <ArrowRight className="h-[19px] w-[19px]" aria-hidden />
        </Boton>
        <Hint>
          Cada fila queda como tarjeta cerrada de este turno, con su foto del combustible
          (obligatoria; litros vacío = turno sin carga). Al final envía el reporte de salida
          como siempre.
        </Hint>
      </Form>
    </Card>
  );
}
