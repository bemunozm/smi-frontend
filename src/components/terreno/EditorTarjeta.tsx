import { useEffect, useState } from 'react';
import { ArrowRight, Check, Lock, Trash2 } from 'lucide-react';

import type { UseEditarTarjetaResult } from '../../hooks/useEditarTarjeta';
import { parseDecimal } from '../../lib/decimal';
import { AYUDA_LITROS } from '../../lib/litros';
import { AdBlueCampos } from './AdBlueCampos';
import {
  AvisoEdicion,
  Boton,
  Calculado,
  Campo,
  Form,
  Hint,
  HistorialCambios,
  Input,
  Label,
  Segmentado,
  Selector,
  Textarea,
} from './ui';

/** Acción «Eliminar tarjeta» — la arma la vista (mutación online + cierre de
 * modales); acá solo se dibujan el botón y su confirmación en dos pasos. */
export interface EliminarTarjetaAccion {
  /** `null` si se puede eliminar; si no, por qué no (se muestra como hint). */
  motivo: string | null;
  eliminar: () => void;
  isEliminando: boolean;
}

function diferenciaHoras(inicial: string, final: string): number | null {
  const a = parseDecimal(inicial);
  const b = parseDecimal(final);
  return a == null || b == null ? null : b - a;
}

const fmt = (n: number) => n.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Corregir una tarjeta de turno ya enviada (queda en su historial de cambios).
 * Abierta: operador (solo en pesados: un liviano no lleva), horómetro o
 * kilometraje inicial y observaciones. Cerrada: además horómetro final, litros y
 * AdBlue. Los datos y las reglas viven en `useEditarTarjeta`; acá solo se dibuja.
 */
export function EditorTarjeta({
  edicion,
  operadores,
  eliminar,
}: {
  edicion: UseEditarTarjetaResult;
  /** Opciones del selector de operador. */
  operadores: { valor: string; titulo: string }[];
  /** «Eliminar tarjeta» (abierta o cerrada) — sin la acción, el botón no existe. */
  eliminar?: EliminarTarjetaAccion;
}) {
  const { editando, form, setForm } = edicion;
  // La confirmación de eliminar vuelve al botón al cambiar de tarjeta: que
  // el «¿Eliminar esta tarjeta?» de una no quede armado para la siguiente.
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const editandoId = editando?.id;
  useEffect(() => setConfirmandoEliminar(false), [editandoId]);
  if (!editando) return null;

  const liviano = editando.liviano === true;
  const lectura = liviano ? 'Kilometraje' : 'Horómetro';
  const unidad = liviano ? 'km' : 'h';
  const horas = edicion.esCerrada && !edicion.finalInvalido ? diferenciaHoras(form.inicial, form.final) : null;

  return (
    <div className="flex flex-col gap-4">
      {edicion.guardado && (
        <p className="m-0 flex items-center gap-2 rounded-2xl bg-[var(--success-soft)] px-3 py-2.5 text-[13px] font-semibold text-[var(--success-soft-foreground)]">
          <Check className="h-4 w-4 shrink-0" /> Cambio guardado en el equipo. Se envía solo.
        </p>
      )}
      {edicion.soloEnElEquipo ? (
        <Hint>Esta tarjeta todavía no se envió: el cambio se aplica antes de enviarla y no genera aviso.</Hint>
      ) : (
        <AvisoEdicion />
      )}
      <Form>
        <Campo label="Equipo">
          <Selector
            etiqueta="Equipo"
            valor={form.equipoId}
            onChange={(equipoId) => setForm((f) => ({ ...f, equipoId }))}
            opciones={edicion.opcionesEquipo}
            tituloTabular
          />
        </Campo>
        {edicion.editaTurno && (
          <div className="flex flex-col gap-1.5">
            <Label>Turno en que salió</Label>
            <Segmentado
              etiqueta="Turno en que salió"
              valor={form.turno}
              onChange={(turno) => setForm((f) => ({ ...f, turno }))}
              opciones={[
                { valor: 'DIURNO', label: 'Diurno' },
                { valor: 'NOCTURNO', label: 'Nocturno' },
              ]}
            />
          </div>
        )}
        {!liviano && (
          <Campo label="Operador">
            <Selector
              etiqueta="Operador"
              valor={form.operatorId}
              onChange={(operatorId) => setForm((f) => ({ ...f, operatorId }))}
              opciones={operadores}
            />
          </Campo>
        )}
        <Campo label={`${lectura} inicial`} unidad={unidad} error={edicion.inicialSobreCarga ?? undefined}>
          <Input numerico value={form.inicial} onChange={(e) => setForm((f) => ({ ...f, inicial: e.target.value }))} />
        </Campo>

        {edicion.esCerrada && (
          <>
            <Campo label={`${lectura} final`} unidad={unidad} error={edicion.finalBajoCarga ?? undefined}>
              <Input numerico value={form.final} onChange={(e) => setForm((f) => ({ ...f, final: e.target.value }))} />
            </Campo>
            {edicion.finalInvalido && (
              <span className="text-[13px] font-semibold text-[var(--danger)]">
                El {lectura.toLowerCase()} final no puede ser menor que el inicial.
              </span>
            )}
            <Calculado
              label={liviano ? 'Recorrido' : 'Horas máquina'}
              nota={
                <span className="flex items-center gap-1.5">
                  <Lock className="h-[13px] w-[13px]" />
                  Calculado · no editable
                </span>
              }
              valor={horas != null ? `${fmt(horas)} ${unidad}` : '—'}
            />
            <Campo label="Combustible cargado" unidad="L" litros hint={`${AYUDA_LITROS} Cero si no cargó.`}>
              <Input
                numerico
                value={form.litros}
                onChange={(e) => setForm((f) => ({ ...f, litros: e.target.value }))}
              />
            </Campo>
            <AdBlueCampos
              adBlue={form.adBlue}
              litros={form.adBlueLitros}
              resultado={edicion.adBlue}
              onAdBlue={(adBlue) => setForm((f) => ({ ...f, adBlue }))}
              onLitros={(adBlueLitros) => setForm((f) => ({ ...f, adBlueLitros }))}
            />
          </>
        )}

        <Campo label="Observaciones">
          <Textarea
            rows={3}
            value={form.observaciones}
            onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
          />
        </Campo>

        {edicion.esCerrada && (
          <Hint>La foto del surtidor no se cambia: es el respaldo de lo que se registró al cerrar.</Hint>
        )}
        <Boton ancho disabled={!edicion.puedeGuardar} onClick={() => void edicion.guardar()}>
          {edicion.isGuardando ? 'Guardando…' : 'Guardar cambios'}
          <ArrowRight className="h-[19px] w-[19px]" />
        </Boton>
        {edicion.faltante && <p className="m-0 text-center text-[12.5px] text-muted-foreground">{edicion.faltante}</p>}
        <Boton variante="contorno" ancho onClick={edicion.cerrarEdicion}>
          {edicion.guardado ? 'Listo' : 'Cancelar'}
        </Boton>

        {eliminar &&
          (confirmandoEliminar ? (
            <div className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-[var(--danger)] bg-[var(--danger-soft)] px-3.5 py-3">
              <p className="m-0 text-[15px] font-semibold text-foreground">
                ¿Eliminar la tarjeta de {editando.equipo}?
              </p>
              <p className="m-0 text-[13px] text-muted-foreground">
                {edicion.esCerrada
                  ? 'Se borra definitivamente, junto con la carga de combustible de su cierre. Se avisará al administrador.'
                  : 'Se borra definitivamente y el equipo queda libre para abrir otra tarjeta. Se avisará al administrador.'}
              </p>
              <Boton
                ancho
                className="!bg-[var(--danger)] !text-white"
                disabled={eliminar.isEliminando}
                onClick={eliminar.eliminar}
              >
                {eliminar.isEliminando ? 'Eliminando…' : 'Sí, eliminar tarjeta'}
                <Trash2 className="h-[18px] w-[18px]" />
              </Boton>
              <Boton variante="contorno" ancho onClick={() => setConfirmandoEliminar(false)}>
                No, conservarla
              </Boton>
            </div>
          ) : (
            <>
              <Boton
                variante="contorno"
                ancho
                className="!text-[var(--danger)]"
                disabled={eliminar.motivo != null}
                title={eliminar.motivo ?? undefined}
                aria-label={`Eliminar tarjeta de ${editando.equipo}${eliminar.motivo ? `. ${eliminar.motivo}` : ''}`}
                onClick={() => setConfirmandoEliminar(true)}
              >
                <Trash2 className="h-4 w-4" /> Eliminar tarjeta
              </Boton>
              {eliminar.motivo && <Hint>{eliminar.motivo}</Hint>}
            </>
          ))}
      </Form>

      {edicion.historialDisponible ? (
        <HistorialCambios entradas={edicion.cambios} cargando={edicion.cargandoCambios} />
      ) : (
        !edicion.soloEnElEquipo && <Hint>El historial de cambios necesita señal.</Hint>
      )}
    </div>
  );
}
