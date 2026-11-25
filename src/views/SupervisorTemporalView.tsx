import { useCallback, useMemo, useState } from 'react';
import { AlertDialog, Button } from '@heroui/react';
import { Clock, FileText, Plus, Trash2 } from 'lucide-react';

import { AbrirTarjetaTemporal } from '../components/temporal/AbrirTarjetaTemporal';
import { CierreTemporalForm } from '../components/temporal/CierreTemporalForm';
import { HistorialReportes } from '../components/temporal/HistorialReportes';
import { Boton, Card, CardHead, Chip, Hint, Hoja, VistaHead, VistaUnica } from '../components/terreno/ui';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useEquipment } from '../hooks/useEquipment';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOperators } from '../hooks/useOperators';
import { useDeleteShiftCard, useShiftCardsMine } from '../hooks/useShiftCards';
import { useShiftProjection } from '../hooks/useShiftProjection';
import { cardIdsEnInformePendiente, fmtLectura, nombreEquipo, type TarjetaTemporal } from '../lib/informe-temporal';
import { plural } from '../lib/format';
import { contextoTurno } from '../lib/turno';
import { generateUuid } from '../lib/uuid';
import { useOutboxOps } from '../offline/useOutboxOps';

/** «24-11 09:44». */
function desdeCorto(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const dia = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${dia} ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

/**
 * «¿Descartar el informe?»: la X de la hoja de cierre con algo escrito. Cerrar
 * la hoja bota lecturas, litros, fotos y personal, así que se pregunta antes.
 */
function ConfirmarDescarte({
  abierto,
  onSeguir,
  onDescartar,
}: {
  abierto: boolean;
  onSeguir: () => void;
  onDescartar: () => void;
}) {
  return (
    <AlertDialog.Backdrop
      isOpen={abierto}
      onOpenChange={(open) => {
        if (!open) onSeguir();
      }}
      className="z-[60]"
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-105">
          <AlertDialog.Header>
            <AlertDialog.Icon status="warning" />
            <AlertDialog.Heading>¿Descartar el informe?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>Se perderá lo que llenaste.</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="tertiary" onPress={onSeguir}>
              Seguir llenando
            </Button>
            <Button variant="danger" onPress={onDescartar}>
              Descartar
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

/** Una tarjeta abierta: código, nombre, lectura inicial, apertura y eliminar. */
function FilaAbierta({
  t,
  motivoSinEliminar,
  eliminando,
  onEliminar,
}: {
  t: TarjetaTemporal;
  /** Por qué no se puede eliminar ahora; `null` si se puede. */
  motivoSinEliminar: string | null;
  eliminando: boolean;
  onEliminar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-border px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="tabular text-[17px] font-bold text-foreground">{t.codigo}</span>
          <span className="text-[13px] text-[var(--label-color)]">{t.nombre}</span>
          <span className="tabular text-[13px] text-[var(--label-color)]">
            Inicial {fmtLectura(t.inicial, t.liviano)} · Abierta {desdeCorto(t.abiertaIso)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {t.sinSincronizar && <Chip tono="warning">Sin sincronizar</Chip>}
          {!confirmando && (
            <button
              type="button"
              aria-label={`Eliminar ${t.codigo}`}
              onClick={() => setConfirmando(true)}
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl bg-[#eef0f2] text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="size-[18px]" aria-hidden />
            </button>
          )}
        </div>
      </div>
      {confirmando &&
        (motivoSinEliminar ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Hint>{motivoSinEliminar}</Hint>
            <Boton variante="contorno" className="!min-h-10 !text-[13.5px]" onClick={() => setConfirmando(false)}>
              Entendido
            </Boton>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13.5px] font-semibold">¿Eliminar la tarjeta de {t.codigo}?</span>
            <div className="flex gap-2">
              <Boton variante="contorno" className="!min-h-10 !text-[13.5px]" onClick={() => setConfirmando(false)}>
                No
              </Boton>
              <Boton className="!min-h-10 !text-[13.5px]" disabled={eliminando} onClick={onEliminar}>
                {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
              </Boton>
            </div>
          </div>
        ))}
    </div>
  );
}

/**
 * Pantalla única del supervisor temporal («Mis equipos»): abre equipos sin
 * ventana de turno y, al terminar la jornada, los cierra TODOS juntos con el
 * informe de actividad (`CierreTemporalForm`, siempre en una hoja). Sus
 * tarjetas no se cierran de a una (el backend responde 409 `TEMPORAL_CARD`):
 * solo por el informe. Abajo, el botón al historial de los informes que envió
 * (`HistorialReportes`).
 *
 * Offline-first como Terreno: la lista junta `mine` con las aperturas que
 * siguen en la cola (`useShiftProjection`). Las tarjetas de un informe que
 * todavía no llega al servidor se sacan de la lista (siguen abiertas en `mine`
 * hasta que se sincronice) para que no se cierren dos veces. Su camioneta
 * va aparte, en «Mi camioneta» (`MiCamionetaView`), y no entra al informe.
 */
export function SupervisorTemporalView() {
  const { user } = useCurrentUser();
  const userId = user?.id;
  const nombre = user?.name?.trim() || user?.email || 'Supervisor';
  const ctx = useMemo(() => contextoTurno(new Date()), []);
  const enLinea = useOnlineStatus();

  const { data: equipos = [] } = useEquipment();
  const { data: operadores = [] } = useOperators({ isActive: true });
  const { data: tarjetasServidor = [] } = useShiftCardsMine({ refetchOnWindowFocus: true });
  const ops = useOutboxOps(userId);
  const proyeccion = useShiftProjection({
    ctx,
    equipos,
    operadores,
    tarjetasServidor,
    ops,
    supervisor: nombre,
    userId,
    rolTemporal: true,
  });

  // El formulario abierto es una «sesión» con su `informeId`, generado al abrirlo.
  // Mientras espera al servidor su operación ya está en la cola: no se oculta a
  // sí mismo (si no, el formulario se desmontaría a mitad del envío).
  const [sesionCierre, setSesionCierre] = useState<{ informeId: string } | null>(null);
  const enInforme = useMemo(
    () => cardIdsEnInformePendiente(ops, sesionCierre?.informeId),
    [ops, sesionCierre?.informeId],
  );
  // Solo las de su informe: `mine` también trae su camioneta y los livianos
  // abiertos por otros («Mi camioneta»), que se cierran sueltos. Además, solo
  // las suyas: una respuesta guardada sin `temporal` no deja colar las ajenas.
  const abiertas: TarjetaTemporal[] = proyeccion.tarjetas
    .filter(
      (t) => t.temporal !== false && t.supervisorId === userId && t.estado === 'curso' && !enInforme.has(t.id),
    )
    .map((t) => {
      const equipo = equipos.find((e) => e.id === t.equipoId);
      return {
        id: t.id,
        equipoId: t.equipoId,
        codigo: t.equipo,
        nombre: equipo ? nombreEquipo(equipo) : t.tipo,
        liviano: !!t.liviano,
        inicial: t.inicial,
        abiertaIso: t.abiertaIso,
        sinSincronizar: t.sinSincronizar,
      };
    });
  const disponibles = [...proyeccion.disponibles, ...proyeccion.disponiblesLivianos];

  const [abriendo, setAbriendo] = useState(false);
  // Abierto, el formulario no se desmonta aunque la lista cambie (p. ej. un 409
  // que refresca las tarjetas y deja cero): así su error sigue a la vista.
  const mostrarCierre = sesionCierre != null;
  // Lo que el formulario avisa hacia arriba: si tiene algo escrito y si se está enviando.
  const [cierreConCambios, setCierreConCambios] = useState(false);
  const [cierreEnviando, setCierreEnviando] = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const cerrarFormulario = useCallback(() => {
    setSesionCierre(null);
    setCierreConCambios(false);
    setCierreEnviando(false);
    setConfirmandoDescarte(false);
  }, []);
  // La X: mientras se envía no hace nada (un 409 tiene que verse en el
  // formulario); con algo escrito pregunta antes de descartarlo.
  const pedirCerrarFormulario = () => {
    if (cierreEnviando) return;
    if (cierreConCambios) setConfirmandoDescarte(true);
    else cerrarFormulario();
  };

  const eliminar = useDeleteShiftCard();
  const motivoSinEliminar = (t: TarjetaTemporal): string | null => {
    if (t.sinSincronizar) return 'Todavía no se envió: se descarta desde el panel de sincronización.';
    if (!enLinea) return 'Para eliminarla hace falta señal.';
    return null;
  };

  return (
    <VistaUnica>
      <VistaHead titulo="Mis equipos" />

      <Card>
        <CardHead
          titulo="Abrir equipo"
          bajada="Sin horario: ábrelo al empezar a usarlo. Se cierra con el informe."
          extra={
            !abriendo && (
              <Boton variante="contorno" className="!min-h-11" onClick={() => setAbriendo(true)}>
                <Plus className="size-[18px]" aria-hidden /> Abrir equipo
              </Boton>
            )
          }
        />
        {abriendo && (
          <>
            <AbrirTarjetaTemporal
              disponibles={disponibles}
              hint={proyeccion.equipoHint}
              userId={userId}
              onAbierta={() => setAbriendo(false)}
            />
            <Boton variante="contorno" ancho className="mt-2.5" onClick={() => setAbriendo(false)}>
              Cancelar
            </Boton>
          </>
        )}
      </Card>

      <Card>
        <CardHead titulo="Equipos abiertos" bajada={plural(abiertas.length, 'equipo abierto', 'equipos abiertos')} />
        <div className="flex flex-col gap-3">
          {abiertas.length === 0 ? (
            <p className="m-0 rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-[var(--label-color)]">
              No tienes equipos abiertos.
            </p>
          ) : (
            abiertas.map((t) => (
              <FilaAbierta
                key={t.id}
                t={t}
                motivoSinEliminar={motivoSinEliminar(t)}
                eliminando={eliminar.isPending}
                onEliminar={() => eliminar.mutate({ id: t.id, equipoCodigo: t.codigo })}
              />
            ))
          )}
          {enInforme.size > 0 && (
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--warning-soft-foreground)]">
              <Clock className="size-3.5" aria-hidden />
              {plural(enInforme.size, 'equipo', 'equipos')} en un informe pendiente de envío: se envía solo al recuperar
              señal.
            </span>
          )}
          <Boton
            ancho
            disabled={abiertas.length === 0}
            onClick={() => setSesionCierre((s) => s ?? { informeId: generateUuid() })}
          >
            <FileText className="size-[19px]" aria-hidden /> Cerrar y generar informe
          </Boton>
        </div>
      </Card>

      <HistorialReportes />

      {/* Siempre en una hoja: diálogo centrado en escritorio, hoja inferior en teléfono. */}
      {mostrarCierre && (
        <Hoja
          eyebrow="Cerrar y generar informe"
          titulo="Informe de actividad"
          bajada="Cierra todos tus equipos abiertos y registra el informe de la jornada."
          amplia
          cerrarAlTocarFuera={false}
          cerrarDeshabilitado={cierreEnviando}
          onCerrar={pedirCerrarFormulario}
        >
          <CierreTemporalForm
            informeId={sesionCierre.informeId}
            tarjetas={abiertas}
            supervisorNombre={nombre}
            onEnviado={cerrarFormulario}
            onCambiosChange={setCierreConCambios}
            onEnviandoChange={setCierreEnviando}
          />
        </Hoja>
      )}
      <ConfirmarDescarte
        abierto={confirmandoDescarte}
        onSeguir={() => setConfirmandoDescarte(false)}
        onDescartar={cerrarFormulario}
      />
    </VistaUnica>
  );
}
