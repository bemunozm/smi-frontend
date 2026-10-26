import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, Pencil, Plus, Trash2, X } from 'lucide-react';

import {
  ENTRADA_VACIA,
  armarEnvio,
  cuentaFotos,
  entradasDesdeDetalle,
  esFotoGuardada,
  noEsNumero,
  numero,
  pendientesItem,
  soloNumero,
  motivosBloqueo,
  type EntradaForm,
  type FotoForm,
} from '../components/checklist/checklist-form';
import { useInsumosFaena } from '../components/mantenimiento/insumos-faena';
import {
  Boton,
  Campo,
  Card,
  CardHead,
  Chip,
  ChipContexto,
  Input,
  Label,
  Segmentado,
  Selector,
  Textarea,
  VistaHead,
  VistaUnica,
  type OpcionSelector,
} from '../components/terreno/ui';
import {
  useChecklistDetalle,
  useChecklistItems,
  useChecklistsPorEstado,
  useDailyChecklists,
  useResubmitDailyChecklist,
  useSubmitDailyChecklist,
} from '../hooks/useDailyChecklists';
import { useEquipment } from '../hooks/useEquipment';
import { usePermissions } from '../hooks/usePermissions';
import { fmtNum } from '../lib/format';
import { fechaCorta, fromDateOnly, toDateOnly } from '../lib/turno';
import {
  ENTRY_STATUSES,
  entryStatusLabel,
  pideFoto,
  type ChecklistItem,
  type DailyChecklistSummary,
  type EntryStatus,
} from '../types/daily-checklist';

const RECHAZADOS = ['REJECTED'] as const;

const COLOR_ESTADO: Record<EntryStatus, string> = {
  MAINTAINED: '#1d4ed8',
  CHECKED: '#15803d',
  NOT_CHECKED: '#6b7280',
};

/**
 * Checklist diario del mantenedor (Módulo 2 · R23 + R24). Elige el equipo,
 * anota el horómetro u odómetro del día y marca cada ítem de la planilla:
 * «se hizo mantención» (con qué se hizo y los insumos, que salen del stock de
 * faena), «se revisó» o «no se revisó». Los críticos con mantención llevan
 * foto. Al enviarlo queda para que el supervisor lo valide (Módulo 3).
 *
 * El borrador vive en la pantalla y se envía entero. Si el supervisor lo
 * rechaza, vuelve acá con su comentario: se abre con lo que ya estaba marcado
 * (`?corregir=<id>`, también desde el aviso), se corrige y se reenvía.
 */
export function ChecklistDiarioView() {
  const hoy = toDateOnly(new Date());
  const { can } = usePermissions();
  const puedeEnviar = can('dailyChecklist.submit');
  const { data: items, isLoading: cargandoItems } = useChecklistItems();
  const { data: equipos } = useEquipment();
  const { data: enviados } = useDailyChecklists(hoy);
  const { faenaBranch, opcionesInsumo } = useInsumosFaena();
  const enviar = useSubmitDailyChecklist();
  const reenviar = useResubmitDailyChecklist();
  const { data: rechazados } = useChecklistsPorEstado(RECHAZADOS, puedeEnviar);

  const [equipmentId, setEquipmentId] = useState('');
  const [counter, setCounter] = useState('');
  const [entradas, setEntradas] = useState<Record<string, EntradaForm>>({});

  // Corrección de un checklist rechazado: `?corregir=<id>` lo trae al formulario.
  const [params, setParams] = useSearchParams();
  const corrigiendo = params.get('corregir');
  const { data: aCorregir } = useChecklistDetalle(corrigiendo);
  const cargado = useRef<string | null>(null);
  useEffect(() => {
    if (!aCorregir || cargado.current === aCorregir.id) return;
    cargado.current = aCorregir.id;
    setEquipmentId(aCorregir.equipment.id);
    setCounter(String(aCorregir.counter).replace('.', ','));
    setEntradas(entradasDesdeDetalle(aCorregir));
  }, [aCorregir]);
  const corregir = (id: string | null) => {
    if (!id) {
      cargado.current = null;
      setEquipmentId('');
      setCounter('');
      setEntradas({});
    }
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('corregir', id);
        else next.delete('corregir');
        return next;
      },
      { replace: true },
    );
    if (id) window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const equipo = equipos?.find((e) => e.id === equipmentId);
  const enviadosPorEquipo = useMemo(() => new Set((enviados ?? []).map((c) => c.equipment.id)), [enviados]);

  // El horómetro se anota a mano y es obligatorio. No se precarga: el checklist
  // se hace a veces a mitad de turno (en la colación) y una lectura vieja
  // precargada se enviaría sin mirar la máquina. Tampoco actualiza la lectura
  // del equipo; solo queda en el checklist.
  const ultimaLectura = equipo ? (equipo.controlUnit === 'KM' ? equipo.currentMileage : equipo.currentHourmeter) : null;
  const anotado = numero(counter);
  // Al corregir, el horómetro que ya se había enviado vale aunque la lectura
  // del equipo haya subido después (al cerrar el turno); si se cambia, no.
  const lecturaMinima = aCorregir && corrigiendo && anotado === aCorregir.counter ? null : ultimaLectura;

  const opcionesEquipo: OpcionSelector[] = useMemo(
    () =>
      (equipos ?? [])
        .slice()
        .sort((a, b) => a.internalCode.localeCompare(b.internalCode))
        .map((e) => ({
          valor: e.id,
          titulo: e.internalCode,
          detalle: e.type,
          ...(enviadosPorEquipo.has(e.id) ? { motivo: 'Checklist de hoy ya enviado' } : {}),
        })),
    [equipos, enviadosPorEquipo],
  );

  const lista = items ?? [];
  const motivos = motivosBloqueo(lista, entradas, {
    counter,
    lecturaInicial: lecturaMinima,
    equipmentId,
    branchId: faenaBranch?.id,
  });
  const fotos = cuentaFotos(lista, entradas);

  const cambiar = (itemId: string, cambio: Partial<EntradaForm>) =>
    setEntradas((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? ENTRADA_VACIA), ...cambio },
    }));

  const onEnviar = () => {
    if (motivos.length > 0) return;
    const envio = armarEnvio(lista, entradas, {
      equipmentId,
      date: aCorregir && corrigiendo ? aCorregir.date : hoy,
      counter,
      branchId: faenaBranch?.id,
    });
    if (aCorregir && corrigiendo) {
      const { counter: contador, branchId, entries } = envio.input;
      reenviar.mutate(
        {
          id: aCorregir.id,
          input: { submission: aCorregir.submissionCount, counter: contador, branchId, entries },
          files: envio.files,
        },
        { onSuccess: () => corregir(null) },
      );
      return;
    }
    enviar.mutate(envio, {
      onSuccess: () => {
        setEquipmentId('');
        setCounter('');
        setEntradas({});
      },
    });
  };
  const ocupado = enviar.isPending || reenviar.isPending;

  const unidad = equipo?.controlUnit === 'KM' ? 'km' : 'h';

  return (
    <VistaUnica>
      <VistaHead titulo="Checklist diario" contexto={<ChipContexto>{fechaCorta(new Date())}</ChipContexto>} />

      {!corrigiendo && <Rechazados checklists={rechazados ?? []} onCorregir={corregir} />}

      {corrigiendo && (
        <div className="flex flex-col gap-2 rounded-3xl border-[1.5px] border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3.5">
          <p className="text-[15px] font-bold text-[var(--danger-soft-foreground)]">
            Corrigiendo el checklist rechazado
            {aCorregir ? ` de ${aCorregir.equipment.internalCode} del ${fechaCorta(fromDateOnly(aCorregir.date))}` : ''}
          </p>
          {aCorregir?.lastReview?.comment && (
            <p className="text-[14px] text-[var(--danger-soft-foreground)]">
              <strong>{aCorregir.lastReview.reviewerName}:</strong> «{aCorregir.lastReview.comment}»
            </p>
          )}
          <p className="text-[13px] text-[var(--danger-soft-foreground)]">
            Cambia lo que haga falta y reenvíalo: vuelve al supervisor para que lo valide de nuevo.
          </p>
          <Boton className="min-h-[44px] self-start px-4 text-sm" variante="contorno" onClick={() => corregir(null)}>
            Cancelar corrección
          </Boton>
        </div>
      )}

      <Card>
        <CardHead titulo="Equipo" bajada="Uno por equipo y por día. Al enviarlo lo valida el supervisor." />
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Campo label="Equipo" requerido>
            {corrigiendo ? (
              <Input readOnly value={aCorregir?.equipment.internalCode ?? 'Cargando…'} />
            ) : (
              <Selector
                etiqueta="Equipo"
                opciones={opcionesEquipo}
                placeholder="Elige el equipo…"
                tituloTabular
                valor={equipmentId}
                onChange={(id) => {
                  setEquipmentId(id);
                  setCounter('');
                }}
              />
            )}
          </Campo>
          <Campo
            error={
              noEsNumero(counter)
                ? 'No es un número válido. Escribe solo dígitos; los decimales van con coma.'
                : anotado !== null && lecturaMinima != null && anotado < lecturaMinima
                  ? `Está mal: ${equipo?.internalCode} partió con ${fmtNum(lecturaMinima)} ${unidad} y no puede marcar menos. Revisa el número.`
                  : undefined
            }
            hint={
              equipo
                ? `Lo que marca la máquina ahora. Queda en el checklist y no cambia la lectura del equipo${
                    ultimaLectura != null ? ` (partió con ${fmtNum(ultimaLectura)} ${unidad})` : ''
                  }.`
                : undefined
            }
            label={equipo?.controlUnit === 'KM' ? 'Odómetro' : 'Horómetro'}
            requerido
            unidad={unidad}
          >
            <Input
              numerico
              disabled={!equipo}
              value={counter}
              onChange={(e) => setCounter(soloNumero(e.target.value))}
            />
          </Campo>
        </div>
      </Card>

      {cargandoItems ? (
        <Card>
          <p className="text-sm text-muted-foreground">Cargando la planilla…</p>
        </Card>
      ) : (
        <>
          {lista.map((item) => (
            <ItemChecklist
              key={item.id}
              entrada={entradas[item.id] ?? ENTRADA_VACIA}
              item={item}
              opcionesInsumo={opcionesInsumo}
              onChange={(cambio) => cambiar(item.id, cambio)}
            />
          ))}
        </>
      )}

      {/* Barra de envío: las fotos obligatorias y por qué todavía no se puede. */}
      <div className="sticky bottom-3 z-10">
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {fotos.obligatorias === 0 ? (
              <span className="text-[14px] text-muted-foreground">
                Sin fotos obligatorias: solo se piden cuando se hace mantención a un ítem crítico.
              </span>
            ) : (
              <>
                <span className="text-[15px] font-semibold">
                  Fotos obligatorias: <span className="tabular">{fotos.conFoto}</span> de{' '}
                  <span className="tabular">{fotos.obligatorias}</span>
                </span>
                <Chip tono={fotos.conFoto === fotos.obligatorias ? 'success' : 'warning'}>
                  {fotos.conFoto === fotos.obligatorias ? 'Completas' : 'Van todas'}
                </Chip>
              </>
            )}
          </div>
          {/* Sin esto el botón quedaba gris sin decir por qué: el checklist lo
              envía el mantenedor, y el administrador entra a Mantención solo a mirar. */}
          {!puedeEnviar && (
            <p className="rounded-xl bg-[var(--warning-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--warning-soft-foreground)]">
              Solo un mantenedor puede enviar el checklist. Entra con una cuenta de mantenedor para enviarlo.
            </p>
          )}
          {motivos.length > 0 && (
            <ul className="flex flex-col gap-1 text-[13px] text-[var(--warning-soft-foreground)]" role="status">
              {motivos.slice(0, 4).map((m) => (
                <li key={m}>· {m}</li>
              ))}
              {motivos.length > 4 && <li>· y {motivos.length - 4} más.</li>}
            </ul>
          )}
          <Boton ancho disabled={!puedeEnviar || motivos.length > 0 || ocupado} variante="acento" onClick={onEnviar}>
            {ocupado ? 'Enviando…' : corrigiendo ? 'Reenviar al supervisor' : 'Enviar al supervisor'}
          </Boton>
        </Card>
      </div>

      <Enviados checklists={enviados ?? []} />
    </VistaUnica>
  );
}

function ItemChecklist({
  item,
  entrada,
  opcionesInsumo,
  onChange,
}: {
  item: ChecklistItem;
  entrada: EntradaForm;
  opcionesInsumo: OpcionSelector[];
  onChange: (cambio: Partial<EntradaForm>) => void;
}) {
  const declarada = entrada.status === 'MAINTAINED' || entrada.status === 'CHECKED';
  const faltan = pendientesItem(item, entrada);
  return (
    <Card className={faltan.length ? 'ring-2 ring-[var(--danger)]' : ''}>
      <div id={`item-${item.id}`} className="mb-3 flex scroll-mt-24 flex-wrap items-center gap-2">
        <h2 className="mr-auto text-[16.5px] leading-tight font-bold">{item.name}</h2>
        {item.requiresPhoto && <Chip tono="danger">Crítico · foto si hay mantención</Chip>}
        {item.requiresTemperature && <Chip tono="info">Temperatura</Chip>}
      </div>
      {faltan.length > 0 && (
        <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]" role="status">
          {faltan.join(' · ')}
        </p>
      )}
      <Segmentado<EntryStatus | ''>
        etiqueta={`Estado de ${item.name}`}
        opciones={ENTRY_STATUSES.map((s) => ({
          valor: s,
          label: entryStatusLabel[s],
          colorActivo: COLOR_ESTADO[s],
        }))}
        valor={entrada.status ?? ''}
        onChange={(status) => onChange({ status: status || null })}
      />

      {declarada && (
        <div className="mt-3.5 flex flex-col gap-3.5">
          {entrada.status === 'MAINTAINED' && (
            <Campo label="¿Qué se hizo?" requerido>
              <Textarea
                placeholder="Describe la mantención realizada…"
                value={entrada.description}
                onChange={(e) => onChange({ description: e.target.value })}
              />
            </Campo>
          )}
          {item.requiresTemperature && (
            <Campo
              error={noEsNumero(entrada.temperature) ? 'No es un número válido.' : undefined}
              hint="La que marca la salida del aire."
              label="Temperatura"
              requerido
              unidad="°C"
            >
              <Input
                numerico
                value={entrada.temperature}
                onChange={(e) => onChange({ temperature: soloNumero(e.target.value, { negativo: true }) })}
              />
            </Campo>
          )}
          {entrada.status === 'MAINTAINED' && (
            <Insumos
              opciones={opcionesInsumo}
              supplies={entrada.supplies}
              onChange={(supplies) => onChange({ supplies })}
            />
          )}
          <Campo label="Nota">
            <Textarea
              className="min-h-[64px]"
              placeholder="Opcional"
              value={entrada.note}
              onChange={(e) => onChange({ note: e.target.value })}
            />
          </Campo>
          <Fotos
            fotos={entrada.photos}
            requerida={pideFoto(item, entrada.status)}
            onChange={(photos) => onChange({ photos })}
          />
        </div>
      )}
    </Card>
  );
}

function Insumos({
  supplies,
  opciones,
  onChange,
}: {
  supplies: EntradaForm['supplies'];
  opciones: OpcionSelector[];
  onChange: (s: EntradaForm['supplies']) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <Label>Insumos usados</Label>
        <Boton
          className="min-h-[44px] px-4 text-sm"
          type="button"
          variante="contorno"
          onClick={() => onChange([...supplies, { insumoId: '', cantidad: '1' }])}
        >
          <Plus className="h-4 w-4" /> Agregar
        </Boton>
      </div>
      {supplies.length === 0 && <span className="text-[13px] text-muted-foreground">Salen del stock de Faena.</span>}
      {supplies.map((s, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_96px_auto] items-end gap-2">
          <Selector
            etiqueta="Insumo"
            opciones={opciones}
            placeholder="Elige el insumo…"
            valor={s.insumoId}
            onChange={(insumoId) => onChange(supplies.map((x, j) => (j === i ? { ...x, insumoId } : x)))}
          />
          <Input
            aria-label="Cantidad"
            numerico
            aria-invalid={noEsNumero(s.cantidad) || undefined}
            className={noEsNumero(s.cantidad) ? 'border-[var(--danger)]' : ''}
            value={s.cantidad}
            onChange={(e) =>
              onChange(
                supplies.map((x, j) =>
                  j === i
                    ? {
                        ...x,
                        cantidad: soloNumero(e.target.value),
                      }
                    : x,
                ),
              )
            }
          />
          <button
            aria-label="Quitar insumo"
            className="grid h-[52px] w-11 cursor-pointer place-items-center rounded-2xl text-muted-foreground hover:text-[var(--danger)]"
            type="button"
            onClick={() => onChange(supplies.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Varias fotos por ítem: se agregan de a una (cámara) o varias (galería). */
function Fotos({
  fotos,
  requerida,
  onChange,
}: {
  fotos: FotoForm[];
  requerida: boolean;
  onChange: (f: FotoForm[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  // Las ya guardadas (al corregir) traen su URL; las nuevas, una local.
  const urls = useMemo(() => fotos.map((f) => (esFotoGuardada(f) ? f.url : URL.createObjectURL(f))), [fotos]);
  useEffect(() => () => urls.forEach((u, i) => fotos[i] instanceof File && URL.revokeObjectURL(u)), [urls, fotos]);

  return (
    <div className="flex flex-col gap-2">
      <Label requerido={requerida}>Fotos</Label>
      {/* Fotos a todo el ancho: una por fila en el teléfono, dos desde `sm`. */}
      {urls.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {urls.map((url, i) => (
            <div key={url} className="relative overflow-hidden rounded-2xl border border-border">
              <img alt={`Foto ${i + 1}`} className="h-44 w-full object-cover" src={url} />
              <button
                aria-label={`Quitar foto ${i + 1}`}
                className="absolute top-2 right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/75"
                type="button"
                onClick={() => onChange(fotos.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* El mismo recuadro que «Foto del hallazgo» y «Foto del surtidor». */}
      {fotos.length < 10 && (
        <button
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-(--accent)/40 bg-(--accent-soft)/60 px-4 py-8 text-center transition hover:bg-(--accent-soft)"
          type="button"
          onClick={() => input.current?.click()}
        >
          <Camera className="h-6 w-6 text-(--accent)" aria-hidden />
          <span className="text-[15px] font-semibold text-(--accent-soft-foreground)">
            {fotos.length === 0 ? 'Agregar foto' : 'Agregar otra foto'}
          </span>
          <span className="text-[13px] text-(--muted)">
            {requerida
              ? 'Obligatoria: es la mantención de un ítem crítico. Puedes agregar varias.'
              : 'Opcional. Puedes agregar varias, hasta 10.'}
          </span>
        </button>
      )}
      <input
        ref={input}
        hidden
        accept="image/*"
        multiple
        type="file"
        onChange={(e) => {
          const nuevas = Array.from(e.target.files ?? []);
          if (nuevas.length) onChange([...fotos, ...nuevas].slice(0, 10));
          e.target.value = '';
        }}
      />
    </div>
  );
}

const ESTADO_ENVIADO: Record<
  DailyChecklistSummary['status'],
  { label: string; tono: 'warning' | 'success' | 'danger' }
> = {
  SUBMITTED: { label: 'Por validar', tono: 'warning' },
  ACCEPTED: { label: 'Aceptado', tono: 'success' },
  REJECTED: { label: 'Rechazado', tono: 'danger' },
};

/** Los checklists que el supervisor rechazó: hay que corregirlos y reenviarlos. */
function Rechazados({
  checklists,
  onCorregir,
}: {
  checklists: DailyChecklistSummary[];
  onCorregir: (id: string) => void;
}) {
  if (checklists.length === 0) return null;
  return (
    <Card className="ring-2 ring-[var(--danger)]">
      <CardHead
        titulo="Rechazados por corregir"
        bajada="El supervisor los devolvió. El equipo no se libera hasta que los corrijas y él los acepte."
        extra={<Chip tono="danger">{checklists.length}</Chip>}
      />
      <ul className="flex flex-col gap-2">
        {checklists.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-border px-3.5 py-3"
          >
            <span className="tabular text-[16px] font-bold">{c.equipment.internalCode}</span>
            <span className="text-[13px] text-muted-foreground">{fechaCorta(fromDateOnly(c.date))}</span>
            <Boton className="ml-auto min-h-[44px] px-4 text-sm" variante="oscuro" onClick={() => onCorregir(c.id)}>
              <Pencil className="h-4 w-4" aria-hidden /> Corregir
            </Boton>
            {c.lastReview?.comment && (
              <p className="w-full text-[13.5px]">
                <strong>{c.lastReview.reviewerName}:</strong> «{c.lastReview.comment}»
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Enviados({ checklists }: { checklists: DailyChecklistSummary[] }) {
  return (
    <Card>
      <CardHead titulo="Enviados hoy" bajada="Los checklists del día y su estado con el supervisor." />
      {checklists.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no se envía ninguno.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {checklists.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className="tabular font-semibold">{c.equipment.internalCode}</span>
              <span className="text-[13px] text-muted-foreground">
                {c.mechanicName} ·{' '}
                {c.maintained > 0
                  ? `${c.maintained} con mantención · ${c.photos} ${c.photos === 1 ? 'foto' : 'fotos'}`
                  : `${c.declared} revisados, sin mantenciones`}
              </span>
              <Chip className="ml-auto" tono={ESTADO_ENVIADO[c.status].tono}>
                {ESTADO_ENVIADO[c.status].label}
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
