import { useState } from 'react';
import { Trash2 } from 'lucide-react';

import { Boton, Campo, Input, ModalTerreno } from '../terreno/ui';
import { useEliminarOrden } from '../../hooks/useOrdenes';
import type { MaintenanceBoardRow } from '../../types/maintenance-board';
import type { OrdenTrabajo } from '../../types/mantenimiento';
import { lectura as fmtLectura, textoPendientes } from './pizarra/pizarra';
import { leerLecturaOpcional, registrableComoHecha } from './workshop';

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold text-muted-foreground">{titulo}</dt>
      <dd className="m-0 text-[14px] font-medium tabular-nums text-foreground">{children}</dd>
    </div>
  );
}

/**
 * «Eliminar» de una operación pendiente o en proceso del tablero (pedido del
 * cliente, 17/11/2026: hay operaciones que no corresponden).
 *
 * Una preventiva de la pauta se abre sola cuando el equipo se acerca al hito:
 * si solo se borrara, la revisión automática la volvería a crear. El diálogo
 * muestra lo que se sabe de ella (hito, tareas hechas, lectura actual y lo que
 * falta) y explica que, si ya se hizo, se puede eliminar registrándola como
 * hecha: queda como último cambio y la próxima se cuenta desde ahí. «Eliminar
 * sin registrar» la borra y vuelve a aparecer cuando le toque.
 */
export function EliminarOperacionModal({
  orden,
  fila,
}: {
  orden: Pick<OrdenTrabajo, 'id' | 'titulo' | 'pautaCycle' | 'origenDetalle' | 'tareas' | 'tipo'>;
  /** La fila de la pizarra del equipo: lectura actual y lo que falta. */
  fila?: MaintenanceBoardRow;
}) {
  const [abierto, setAbierto] = useState(false);
  const [lectura, setLectura] = useState('');
  const eliminar = useEliminarOrden();
  // Pauta (también las órdenes antiguas) y servicios de livianos: las crea
  // el sistema solo, así que se ofrece registrarlas como hechas.
  const dePauta = registrableComoHecha(orden);
  const unidad = fila?.unit ?? 'h';
  // En km, entero con separador de miles («264.582» = 264582 km); en horas,
  // decimal. No puede superar la lectura actual del equipo, si se conoce.
  const lecturaLeida = leerLecturaOpcional(lectura, { unidad, actual: fila?.counter ?? null });
  const lecturaNum = 'valor' in lecturaLeida ? lecturaLeida.valor : undefined;
  const errorLectura = 'error' in lecturaLeida ? lecturaLeida.error : undefined;
  const lecturaInvalida = errorLectura != null;
  const hechas = orden.tareas.filter((t) => t.hecha).length;
  const pendientes = fila && fila.source !== 'SIN_PAUTA' ? textoPendientes(fila) : null;
  const atrasada = fila?.remaining != null && fila.remaining < 0;

  const cerrar = () => {
    setAbierto(false);
    setLectura('');
  };
  const confirmar = (yaHecha: boolean) => {
    eliminar.mutate(
      {
        id: orden.id,
        titulo: orden.titulo,
        opciones: yaHecha ? { yaHecha: true, ...(lecturaNum != null ? { lecturaMantencion: lecturaNum } : {}) } : {},
      },
      { onSuccess: cerrar },
    );
  };

  return (
    <>
      {/* Ícono arriba a la derecha de la tarjeta: lejos del botón principal,
          para no borrar por error al registrar la mantención. */}
      <button
        aria-label="Eliminar"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-[var(--danger)] transition-colors hover:border-[var(--danger)] hover:bg-[var(--danger-soft)]"
        onClick={() => setAbierto(true)}
        title="Eliminar operación"
        type="button"
      >
        <Trash2 aria-hidden className="size-4" />
      </button>
      <ModalTerreno
        abierto={abierto}
        detalle={orden.titulo}
        onAbiertoChange={(v) => (v ? setAbierto(true) : cerrar())}
        titulo="¿Eliminar esta operación?"
      >
        <div className="flex flex-col gap-4 p-4">
          {dePauta ? (
            <>
              {/* Lo que se sabe de la mantención, para decidir sin ir a la pizarra. */}
              <dl
                className="m-0 grid grid-cols-2 gap-3 rounded-2xl bg-[#f5f6f8] px-3.5 py-3 sm:grid-cols-4"
                data-testid="eliminar-datos"
              >
                <Dato titulo="Mantención">{orden.origenDetalle?.replace(/^(Pauta|Livianos):\s*/, '') ?? '—'}</Dato>
                <Dato titulo="Tareas hechas">
                  {orden.tareas.length > 0 ? `${hechas} de ${orden.tareas.length}` : '—'}
                </Dato>
                <Dato titulo={unidad === 'km' ? 'Km actual' : 'Horómetro actual'}>
                  {fila ? (fmtLectura(fila.counter, unidad) ?? 'Sin lectura') : '—'}
                </Dato>
                <Dato titulo={unidad === 'km' ? 'Km pendientes' : 'Horas pendientes'}>
                  {pendientes == null ? '—' : atrasada ? `Atrasada ${pendientes}` : pendientes}
                </Dato>
              </dl>
              <p className="m-0 text-[14.5px] leading-snug text-foreground">
                <b>Si esta mantención ya se hizo, puedes eliminarla.</b> Queda registrada como hecha (último cambio), la
                próxima se cuenta desde ahí y el sistema no la vuelve a crear.
              </p>
              <div className="flex flex-col gap-2.5 rounded-2xl border border-border p-3.5">
                <Campo
                  label="Lectura a la que se hizo (opcional)"
                  unidad={unidad}
                  hint="Vacío = la lectura actual del equipo."
                  error={errorLectura}
                >
                  <Input
                    entero={unidad === 'km'}
                    numerico={unidad === 'h'}
                    value={lectura}
                    onChange={(e) => setLectura(e.target.value)}
                  />
                </Campo>
                <Boton
                  ancho
                  disabled={eliminar.isPending || lecturaInvalida}
                  onClick={() => confirmar(true)}
                  variante="acento"
                >
                  {eliminar.isPending ? 'Guardando…' : 'Ya se hizo: registrar y eliminar'}
                </Boton>
              </div>
              <div className="flex flex-col gap-2.5 rounded-2xl border border-border p-3.5">
                <b className="text-[14.5px]">Si no corresponde</b>
                <p className="m-0 text-[13.5px] text-muted-foreground">
                  Se borra sin registrar nada. Si la mantención sigue pendiente, la tarjeta vuelve a aparecer sola
                  cuando le toque.
                </p>
                <Boton ancho disabled={eliminar.isPending} onClick={() => confirmar(false)} variante="contorno">
                  Eliminar sin registrar
                </Boton>
              </div>
            </>
          ) : (
            <>
              <p className="m-0 text-[14.5px] leading-snug text-foreground">
                La operación se borra del tablero. Si venía de un hallazgo, el hallazgo vuelve a quedar abierto en la
                bandeja. Los insumos que ya se descontaron no se devuelven.
              </p>
              <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
                <Boton disabled={eliminar.isPending} onClick={() => confirmar(false)}>
                  {eliminar.isPending ? 'Eliminando…' : 'Eliminar'}
                </Boton>
                <Boton onClick={cerrar} variante="contorno">
                  Cancelar
                </Boton>
              </div>
            </>
          )}
        </div>
      </ModalTerreno>
    </>
  );
}
