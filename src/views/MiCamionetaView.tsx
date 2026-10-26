import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock, Eye, Fuel, Lock, Truck } from 'lucide-react';

import { FotoRespaldoField } from '../components/flota/FotoRespaldoField';
import {
  Boton,
  Calculado,
  Campo,
  Card,
  CardHead,
  Chip,
  Cifras,
  Form,
  Hint,
  Input,
  Label,
  Selector,
  Tarjeta,
  Textarea,
  VistaHead,
  VistaSplit,
} from '../components/terreno/ui';
import { useAperturaForm } from '../hooks/useAperturaForm';
import { useCierreForm } from '../hooks/useCierreForm';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useEquipment } from '../hooks/useEquipment';
import { useShiftCardsMine } from '../hooks/useShiftCards';
import { useShiftProjection } from '../hooks/useShiftProjection';
import type { TarjetaTurno } from '../hooks/shift-register-helpers';
import { formatDecimalInput } from '../lib/decimal';
import { fmtLitros } from '../lib/format';
import { contextoTurno } from '../lib/turno';
import type { OutboxOp } from '../offline/db';
import { useOutboxOps } from '../offline/useOutboxOps';

const fmtKm = (n: number | undefined) =>
  n == null ? '—' : `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })} km`;

/** «45 min», «3 h 10 min», «1 día 4 h». */
function tiempoEnUso(desdeIso: string | undefined, ahora: Date): string {
  if (!desdeIso) return '—';
  const min = Math.max(0, Math.floor((ahora.getTime() - new Date(desdeIso).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? 'día' : 'días'}${h % 24 ? ` ${h % 24} h` : ''}`;
}

/** «26-10 09:44» — corto, para que quepa en tablet y celular. */
function desdeCorto(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const dia = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${dia} ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

/** Cada cuánto se revisa si alguien más la abrió o la cerró (otro equipo, un supervisor). */
const REFRESCO_MS = 60_000;

/** La operación de la cola (abrir o cerrar) que todavía no llega al servidor para esa tarjeta. */
function opDe(ops: readonly OutboxOp[], cardId: string): OutboxOp | undefined {
  const deLaTarjeta = ops.filter(
    (op) => (op.type === 'openCard' && op.id === cardId) || (op.type === 'closeCard' && op.payload.cardId === cardId),
  );
  return deLaTarjeta.find((op) => op.status === 'needs_attention') ?? deLaTarjeta[0];
}

/** Si la tarjeta sigue en el equipo: esperando señal, o rechazada por el servidor. */
function EstadoSync({ op }: { op: OutboxOp | undefined }) {
  if (!op) return null;
  if (op.status === 'needs_attention') {
    return (
      <div className="flex items-start gap-2 rounded-2xl bg-[var(--danger-soft)] px-3.5 py-2.5 text-[13.5px] text-[var(--danger-soft-foreground)]">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <b>No se pudo enviar.</b> {op.lastError?.message ?? 'El servidor la rechazó.'} Ábrelo en la sincronización
          (arriba, junto a «En línea») para reintentar o descartar.
        </span>
      </div>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--warning-soft-foreground)]">
      <Clock className="size-3.5" aria-hidden /> Guardada en el equipo · falta sincronizar
    </span>
  );
}

/** Un uso ya cerrado: km, recorrido, litros y quién lo cerró. */
function UsoCerrado({ t, op }: { t: TarjetaTurno; op: OutboxOp | undefined }) {
  return (
    <Tarjeta>
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <div className="tabular text-[17px] font-semibold">{t.equipo}</div>
          <div className="text-[13px] text-[var(--label-color)]">
            {t.abiertaEl} → {t.cerradaA ?? '—'}
            {t.cerradaPor ? ` · cerró ${t.cerradaPor}` : ''}
          </div>
        </div>
        <Chip tono="success">Cerrada</Chip>
      </div>
      <Cifras
        items={[
          { label: 'Km inicial', valor: fmtKm(t.inicial) },
          { label: 'Km final', valor: fmtKm(t.final) },
          { label: 'Recorrido', valor: t.final != null ? fmtKm(t.final - t.inicial) : '—', destacado: true },
          { label: 'Litros', valor: fmtLitros(t.litros) },
        ]}
      />
      <EstadoSync op={op} />
    </Tarjeta>
  );
}

/**
 * «Mi camioneta» del mantenedor, vista propia del taller: la camioneta con que
 * se mueve en faena. Abre con el km inicial y se cierra recién al cargar
 * combustible (km final, litros y foto del surtidor). Es la misma tarjeta de
 * liviano del supervisor (`/shift-cards`), así que también la ve —y la puede
 * cerrar— un supervisor. Va por la cola sin conexión, igual que en Terreno, y
 * dice cuando algo no llegó al servidor.
 */
export function MiCamionetaView() {
  const { user } = useCurrentUser();
  const userId = user?.id;
  const nombre = user?.name?.trim() || user?.email || 'Mantenedor';
  // El turno solo agrupa la tarjeta; el mantenedor no manda reporte de salida.
  const ctx = useMemo(() => contextoTurno(new Date()), []);
  const navigate = useNavigate();

  const { data: equipos = [] } = useEquipment();
  // Se refresca sola: la camioneta la puede cerrar un supervisor, o abrirla
  // el mismo mantenedor desde otro equipo.
  const { data: tarjetasServidor = [] } = useShiftCardsMine({
    refetchInterval: REFRESCO_MS,
    refetchOnWindowFocus: true,
  });
  const ops = useOutboxOps(userId);
  const proyeccion = useShiftProjection({
    ctx,
    equipos,
    operadores: [],
    tarjetasServidor,
    ops,
    supervisor: nombre,
    userId,
  });
  const mia = proyeccion.livianosAbiertos.find((t) => t.supervisorId === userId);
  // Las que usé o cerré yo (el servidor trae las cerradas de las últimas 48 h).
  const misUsos = proyeccion.livianosCerrados.filter((t) => t.supervisorId === userId || t.cerradaPorId === userId);

  const apertura = useAperturaForm({ disponibles: proyeccion.disponiblesLivianos, ctx, userId, liviano: true });
  const cierre = useCierreForm({ tarjetas: proyeccion.tarjetas, ctx, userId });
  const camioneta = apertura.equipoElegido;
  const equipoEnUso = mia ? equipos.find((e) => e.internalCode === mia.equipo) : undefined;
  const cerrandoMia = mia != null && cierre.cerrandoId === mia.id;

  const enUso = mia && (
    <Card>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent)] text-white">
              <Truck className="size-6" aria-hidden />
            </span>
            <div className="flex flex-col">
              <span className="tabular text-[22px] leading-tight font-bold text-foreground">{mia.equipo}</span>
              <span className="text-[13.5px] text-[var(--label-color)]">
                {[
                  mia.tipo,
                  equipoEnUso?.licensePlate,
                  [equipoEnUso?.brand, equipoEnUso?.model].filter(Boolean).join(' '),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
          </div>
          <Chip tono="info">En uso</Chip>
        </div>

        <Cifras
          items={[
            { label: 'Km inicial', valor: fmtKm(mia.inicial), destacado: true },
            { label: 'Desde', valor: desdeCorto(mia.abiertaIso) },
            { label: 'En uso hace', valor: tiempoEnUso(mia.abiertaIso, new Date()) },
          ]}
        />

        <EstadoSync op={opDe(ops, mia.id)} />

        {!cerrandoMia && (
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Boton className="sm:flex-1 lg:flex-none" onClick={() => cierre.abrirCierre(mia.id)}>
              <Fuel className="size-[18px]" aria-hidden /> Cargar combustible y cerrar
            </Boton>
            {equipoEnUso && (
              <Boton variante="contorno" onClick={() => navigate(`/mantenimiento/equipos/${equipoEnUso.id}`)}>
                <Eye className="size-[18px]" aria-hidden /> Ver camioneta
              </Boton>
            )}
          </div>
        )}
      </div>
    </Card>
  );

  const formCierre = cerrandoMia && cierre.cerrando && (
    <Card>
      <CardHead
        titulo="Cargar combustible y cerrar"
        bajada="Kilometraje final, litros y la foto del surtidor."
        extra={
          <Boton variante="contorno" className="!min-h-10 !text-[13.5px]" onClick={() => cierre.setCerrandoId(null)}>
            Cancelar
          </Boton>
        }
      />
      <Form>
        <div className="flex items-center justify-between rounded-2xl bg-[#f3f4f6] px-3.5 py-3">
          <Label>Kilometraje inicial</Label>
          <b className="tabular text-[17px] font-medium">{fmtKm(cierre.cerrando.inicial)}</b>
        </div>
        <Campo
          label="Kilometraje final"
          requerido
          unidad="km"
          error={cierre.finalInvalido ? 'No puede ser menor que el kilometraje inicial.' : undefined}
        >
          <Input
            numerico
            value={cierre.cierre.final}
            onChange={(e) => cierre.setCierre((c) => ({ ...c, final: e.target.value }))}
          />
        </Campo>
        <Calculado
          label="Kilómetros recorridos"
          nota={
            <span className="flex items-center gap-1.5">
              <Lock className="size-[13px]" /> Calculado · no editable
            </span>
          }
          valor={cierre.horasMaquina != null && cierre.horasMaquina >= 0 ? fmtKm(cierre.horasMaquina) : '—'}
        />
        <Campo
          label="Combustible cargado"
          requerido
          unidad="L"
          error={cierre.litrosError ?? undefined}
          aviso={cierre.litrosAviso ?? undefined}
        >
          <Input
            numerico
            value={cierre.cierre.litros}
            onChange={(e) => cierre.setCierre((c) => ({ ...c, litros: e.target.value }))}
          />
        </Campo>
        <FotoRespaldoField
          file={cierre.foto.file}
          isReadingPhoto={cierre.foto.isReadingPhoto}
          captureDate={cierre.foto.captureDate}
          onSelect={cierre.foto.handleSelectPhoto}
          onClear={cierre.foto.handleClearPhoto}
          title="Foto del surtidor"
          subtitle="Debe verse el totalizador. Los litros se leen de la foto y quedan editables."
          staleQuestion="¿Es la carga de esta camioneta?"
        />
        <Campo label="Observaciones">
          <Textarea
            rows={2}
            placeholder="Novedades de la camioneta"
            value={cierre.cierre.observaciones}
            onChange={(e) => cierre.setCierre((c) => ({ ...c, observaciones: e.target.value }))}
          />
        </Campo>
        <Boton
          ancho
          onClick={() => void cierre.cerrar()}
          disabled={
            !cierre.foto.file ||
            cierre.foto.isReadingPhoto ||
            cierre.isCerrando ||
            cierre.finalNum == null ||
            cierre.finalInvalido ||
            cierre.litrosError != null
          }
        >
          {cierre.isCerrando ? 'Cerrando…' : 'Cerrar tarjeta'} <ArrowRight className="size-[19px]" />
        </Boton>
        {!cierre.foto.file && (
          <p className="m-0 text-center text-[12.5px] text-[var(--label-color)]">
            Falta la foto del surtidor para cerrar.
          </p>
        )}
      </Form>
    </Card>
  );

  const formApertura = !mia && (
    <Card>
      <CardHead
        titulo="Usar una camioneta"
        bajada="Anota el kilometraje al tomarla. Queda abierta hasta que cargues combustible."
      />
      {proyeccion.disponiblesLivianos.length === 0 ? (
        <Hint>No hay camionetas libres: todas tienen una tarjeta abierta.</Hint>
      ) : (
        <Form>
          <Campo label="Camioneta">
            <Selector
              etiqueta="Camioneta"
              tituloTabular
              valor={camioneta?.id ?? ''}
              onChange={(id) => {
                const eq = proyeccion.disponiblesLivianos.find((x) => x.id === id);
                apertura.setApertura((a) => ({
                  ...a,
                  equipoId: id,
                  horometro: formatDecimalInput(eq?.currentMileage, 0),
                }));
              }}
              opciones={proyeccion.disponiblesLivianos.map((e) => ({
                valor: e.id,
                titulo: e.internalCode,
                detalle: [e.type, e.licensePlate].filter(Boolean).join(' · '),
              }))}
            />
          </Campo>
          <Campo
            label="Kilometraje inicial"
            unidad="km"
            error={apertura.horometroInvalido ? 'Escribe un número, por ejemplo 45120.' : undefined}
            aviso={
              apertura.bajoUltimaLectura && camioneta?.currentMileage != null
                ? `Es menor que el último registrado (${fmtKm(camioneta.currentMileage)}). Revisa que esté bien.`
                : undefined
            }
            hint={
              camioneta?.currentMileage != null
                ? `Último registrado: ${fmtKm(camioneta.currentMileage)}`
                : 'Sin kilometraje previo para esta camioneta.'
            }
          >
            <Input
              numerico
              value={apertura.apertura.horometro}
              placeholder={camioneta?.currentMileage != null ? formatDecimalInput(camioneta.currentMileage, 0) : '0'}
              onChange={(e) => apertura.setApertura((a) => ({ ...a, horometro: e.target.value }))}
            />
          </Campo>
          <Boton ancho disabled={apertura.isAbriendo || apertura.valorInicialApertura == null} onClick={apertura.abrir}>
            Empezar a usarla <ArrowRight className="size-[19px]" />
          </Boton>
        </Form>
      )}
    </Card>
  );

  const historial = (
    <>
      <h2 className="m-0 text-[17px] font-bold">Mis últimos usos</h2>
      {misUsos.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-8 text-center text-sm text-[var(--label-color)]">
          Todavía no hay usos cerrados en las últimas 48 horas.
        </p>
      ) : (
        misUsos.map((t) => <UsoCerrado key={t.id} t={t} op={opDe(ops, t.id)} />)
      )}
    </>
  );

  return (
    <>
      <VistaHead titulo="Mi camioneta" />
      <VistaSplit
        formulario={
          <>
            {enUso}
            {formCierre}
            {formApertura}
          </>
        }
        historial={historial}
      />
    </>
  );
}
