import { ArrowRight, Check, Lock } from 'lucide-react';

import type { UseEditarTarjetaResult } from '../../hooks/useEditarTarjeta';
import { aNumero } from '../../hooks/shift-register-helpers';
import { AdBlueCampos } from './AdBlueCampos';
import { AvisoEdicion, Boton, Calculado, Campo, Form, Hint, HistorialCambios, Input, Selector, Textarea } from './ui';

function diferenciaHoras(inicial: string, final: string): number | null {
  const a = aNumero(inicial);
  const b = aNumero(final);
  return a == null || b == null ? null : b - a;
}

const fmt = (n: number) => n.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Corregir una tarjeta de turno (Acta N.° 004, R13). Abierta: operador,
 * horómetro inicial y observaciones. Cerrada: además horómetro final, litros y
 * AdBlue. Los datos y las reglas viven en `useEditarTarjeta`; acá solo se dibuja.
 */
export function EditorTarjeta({
  edicion,
  operadores,
}: {
  edicion: UseEditarTarjetaResult;
  /** Opciones del selector de operador. */
  operadores: { valor: string; titulo: string }[];
}) {
  const { editando, form, setForm } = edicion;
  if (!editando) return null;

  const horas =
    edicion.esCerrada && !edicion.finalInvalido ? diferenciaHoras(form.inicial, form.final) : null;

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
        <Campo label="Operador">
          <Selector
            etiqueta="Operador"
            valor={form.operatorId}
            onChange={(operatorId) => setForm((f) => ({ ...f, operatorId }))}
            opciones={operadores}
          />
        </Campo>
        <Campo label="Horómetro inicial" unidad="h">
          <Input numerico value={form.inicial} onChange={(e) => setForm((f) => ({ ...f, inicial: e.target.value }))} />
        </Campo>

        {edicion.esCerrada && (
          <>
            <Campo label="Horómetro final" unidad="h">
              <Input numerico value={form.final} onChange={(e) => setForm((f) => ({ ...f, final: e.target.value }))} />
            </Campo>
            {edicion.finalInvalido && (
              <span className="text-[13px] font-semibold text-[var(--danger)]">
                No puede ser menor que el horómetro inicial.
              </span>
            )}
            <Calculado
              label="Horas máquina"
              nota={
                <span className="flex items-center gap-1.5">
                  <Lock className="h-[13px] w-[13px]" />
                  Calculado · no editable
                </span>
              }
              valor={horas != null ? `${fmt(horas)} h` : '—'}
            />
            <Campo label="Combustible cargado" unidad="L">
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

        <Boton ancho disabled={!edicion.puedeGuardar} onClick={() => void edicion.guardar()}>
          {edicion.isGuardando ? 'Guardando…' : 'Guardar cambios'}
          <ArrowRight className="h-[19px] w-[19px]" />
        </Boton>
        <Boton variante="contorno" ancho onClick={edicion.cerrarEdicion}>
          {edicion.guardado ? 'Listo' : 'Cancelar'}
        </Boton>
      </Form>

      {edicion.historialDisponible ? (
        <HistorialCambios entradas={edicion.cambios} cargando={edicion.cargandoCambios} />
      ) : (
        !edicion.soloEnElEquipo && <Hint>El historial de cambios necesita señal.</Hint>
      )}
    </div>
  );
}

