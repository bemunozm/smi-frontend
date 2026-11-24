import { PenLine, Trash2, UserPlus } from 'lucide-react';

import { OperatorPicker } from '../operators/OperatorPicker';
import { Campo, Input, Label } from '../terreno/ui';
import { MAX_PERSONAL_POR_ACTIVIDAD, nuevaLinea, type PersonaForm } from '../../lib/informe-temporal';

/** Una línea del personal: del catálogo (`OperatorPicker`) o escrita a mano (personal de apoyo). */
export interface LineaPersonal extends PersonaForm {
  /** Solo para la `key` de React: quitar una línea del medio no corre lo
   * escrito (ni el operador elegido) a la línea de abajo. No viaja al backend. */
  id: string;
  modo: 'catalogo' | 'texto';
}

/**
 * «Personal de actividad N» del informe: hasta 10 líneas, como el papel. Cada
 * línea es un operador del catálogo o un nombre escrito a mano para quien no
 * está en el catálogo.
 */
export function PersonalActividad({
  actividad,
  lineas,
  onChange,
  error,
}: {
  actividad: 1 | 2;
  lineas: LineaPersonal[];
  onChange: (lineas: LineaPersonal[]) => void;
  error?: string;
}) {
  const lleno = lineas.length >= MAX_PERSONAL_POR_ACTIVIDAD;
  const cambiar = (i: number, cambio: Partial<LineaPersonal>) =>
    onChange(lineas.map((l, j) => (j === i ? { ...l, ...cambio } : l)));
  const agregar = (modo: LineaPersonal['modo']) =>
    onChange([...lineas, nuevaLinea({ modo, operatorId: null, nombre: '' })]);

  return (
    <div className="flex flex-col gap-2.5">
      <Label>
        Personal de actividad {actividad} · {lineas.length}/{MAX_PERSONAL_POR_ACTIVIDAD}
      </Label>
      {lineas.map((linea, i) => (
        <div key={linea.id} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            {linea.modo === 'catalogo' ? (
              <OperatorPicker
                label={`Persona ${i + 1}`}
                value={linea.operatorId}
                onChange={(op) => cambiar(i, { operatorId: op?.id ?? null, nombre: op?.name ?? '' })}
              />
            ) : (
              <Campo label={`Persona ${i + 1}`}>
                <Input
                  aria-label={`Nombre de la persona ${i + 1} de la actividad ${actividad}`}
                  value={linea.nombre}
                  maxLength={120}
                  onChange={(e) => cambiar(i, { nombre: e.target.value })}
                />
              </Campo>
            )}
          </div>
          <button
            type="button"
            aria-label={`Quitar persona ${i + 1} de la actividad ${actividad}`}
            onClick={() => onChange(lineas.filter((_, j) => j !== i))}
            className="grid h-[52px] w-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-[#eef0f2] text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="size-[18px]" aria-hidden />
          </button>
        </div>
      ))}
      {!lleno && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-label={`Agregar operador en actividad ${actividad}`}
            onClick={() => agregar('catalogo')}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-[var(--line2,#c3c9d1)] bg-card px-3.5 text-[14px] font-semibold hover:border-foreground"
          >
            <UserPlus className="size-4" aria-hidden /> Agregar operador
          </button>
          <button
            type="button"
            aria-label={`Escribir nombre en actividad ${actividad}`}
            onClick={() => agregar('texto')}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-[var(--line2,#c3c9d1)] bg-card px-3.5 text-[14px] font-semibold hover:border-foreground"
          >
            <PenLine className="size-4" aria-hidden /> Escribir nombre
          </button>
        </div>
      )}
      {error && (
        <span className="text-[12.5px] leading-snug font-semibold text-[var(--danger)]" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
