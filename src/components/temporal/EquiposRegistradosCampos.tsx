import { Plus, Trash2 } from 'lucide-react';

import { Boton, Campo, Hint, Input, Label, SelectorBuscable, type OpcionSelector } from '../terreno/ui';
import { useEquipment } from '../../hooks/useEquipment';
import { claveErrorEquipo, MAX_EQUIPOS_INFORME, type FilaEquipoForm } from '../../lib/informe-antiguo';
import { nombreEquipo } from '../../lib/informe-temporal';
import { generateUuid } from '../../lib/uuid';

/** Una fila nueva, vacía. */
export const filaEquipoVacia = (): FilaEquipoForm => ({
  id: generateUuid(),
  equipoId: '',
  inicial: '',
  final: '',
  litros: '',
});

/**
 * Los equipos de un informe subido después, escritos a mano desde el papel:
 * equipo del catálogo, lectura inicial y final y litros (opcional). No abren
 * ni cierran tarjetas ni mueven el contador del equipo. Lo usan el alta
 * (`InformeAntiguoForm`) y la corrección (`EditarInformeTemporalModal`).
 */
export function EquiposRegistradosCampos({
  filas,
  onChange,
  errores,
}: {
  filas: FilaEquipoForm[];
  onChange: (filas: FilaEquipoForm[]) => void;
  /** Errores del formulario (solo se muestran tras intentar enviar). */
  errores: Record<string, string>;
}) {
  // El catálogo de Flota (guardado en el equipo: sirve sin señal).
  const { data: equipos = [] } = useEquipment();
  const opciones: OpcionSelector[] = equipos
    .map((e) => ({ valor: e.id, titulo: e.internalCode, detalle: nombreEquipo(e) }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo));
  const cambiar = (i: number, cambio: Partial<FilaEquipoForm>) =>
    onChange(filas.map((f, j) => (j === i ? { ...f, ...cambio } : f)));

  return (
    <div className="flex flex-col gap-2.5">
      <Label requerido>
        Equipos del informe · {filas.length}/{MAX_EQUIPOS_INFORME}
      </Label>
      <Hint>Escribe las lecturas del papel. No abren ni cierran equipos ni cambian su contador.</Hint>
      {filas.map((fila, i) => {
        const equipo = equipos.find((e) => e.id === fila.equipoId);
        const unidad = equipo?.equipmentClass === 'LIGHT' ? 'km' : 'h';
        return (
          <section
            key={fila.id}
            role="group"
            aria-label={`Equipo ${i + 1}`}
            className="flex flex-col gap-2.5 rounded-2xl border border-border p-3"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Campo label={`Equipo ${i + 1}`} requerido error={errores[claveErrorEquipo('equipo', fila.id)]}>
                  <SelectorBuscable
                    etiqueta={`Equipo ${i + 1}`}
                    placeholder="Busca el equipo"
                    tituloTabular
                    valor={fila.equipoId}
                    onChange={(equipoId) => cambiar(i, { equipoId })}
                    opciones={opciones}
                  />
                </Campo>
              </div>
              <button
                type="button"
                aria-label={`Quitar el equipo ${i + 1}`}
                onClick={() => onChange(filas.filter((_, j) => j !== i))}
                className="grid h-[52px] w-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-[#eef0f2] text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="size-[18px]" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Campo
                label="Lectura inicial"
                requerido
                unidad={unidad}
                error={errores[claveErrorEquipo('inicial', fila.id)]}
              >
                <Input
                  numerico
                  aria-label={`Lectura inicial del equipo ${i + 1}`}
                  value={fila.inicial}
                  onChange={(e) => cambiar(i, { inicial: e.target.value })}
                />
              </Campo>
              <Campo
                label="Lectura final"
                requerido
                unidad={unidad}
                error={errores[claveErrorEquipo('final', fila.id)]}
              >
                <Input
                  numerico
                  aria-label={`Lectura final del equipo ${i + 1}`}
                  value={fila.final}
                  onChange={(e) => cambiar(i, { final: e.target.value })}
                />
              </Campo>
            </div>
            <Campo label="Litros (opcional)" unidad="L" litros error={errores[claveErrorEquipo('litros', fila.id)]}>
              <Input
                numerico
                aria-label={`Litros del equipo ${i + 1}`}
                value={fila.litros}
                onChange={(e) => cambiar(i, { litros: e.target.value })}
              />
            </Campo>
          </section>
        );
      })}
      {filas.length < MAX_EQUIPOS_INFORME && (
        <Boton variante="contorno" ancho type="button" onClick={() => onChange([...filas, filaEquipoVacia()])}>
          <Plus className="size-[18px]" aria-hidden /> Agregar equipo
        </Boton>
      )}
      {errores.equipos && (
        <span className="text-[12.5px] leading-snug font-semibold text-[var(--danger)]" role="alert">
          {errores.equipos}
        </span>
      )}
    </div>
  );
}
