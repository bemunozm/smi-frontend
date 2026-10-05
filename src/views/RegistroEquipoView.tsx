import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  History,
  Lock,
  Mail,
  Pencil,
  User,
} from 'lucide-react';

import { lineaEstadoCorreo, useShiftRegister, type EstadoReporte, type TarjetaTurno } from '../hooks/useShiftRegister';
import { FotoRespaldoField } from '../components/flota/FotoRespaldoField';
import { AdBlueCampos } from '../components/terreno/AdBlueCampos';
import { EditorTarjeta } from '../components/terreno/EditorTarjeta';
import { MarcaSinSincronizar } from '../components/terreno/MarcaSinSincronizar';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { fmtTime, plural } from '../lib/format';
import { fechaCorta, type Turno } from '../lib/turno';
import {
  BloqueTurno,
  Boton,
  CabeceraTurno,
  Calculado,
  Campo,
  Card,
  CardHead,
  Chip,
  Cifras,
  Filas,
  Form,
  GrupoHead,
  Hint,
  Hoja,
  Input,
  Label,
  ModalTerreno,
  Selector,
  Tabla,
  Tarjeta,
  Textarea,
  TD,
  TH,
  VistaHead,
  VistaSplit,
} from '../components/terreno/ui';

/**
 * Registro de equipo — Módulo A de la especificación del 21/09/2026.
 *
 * Fusiona lo que hoy son dos pantallas sueltas, Horómetro y Combustible, en una
 * sola tarjeta por equipo: se abre al empezar el turno con el horómetro inicial
 * y se cierra al terminar con el final, los litros y la foto del surtidor.
 *
 * El paso que de verdad importa es el del medio: **enviar el reporte de salida**.
 * Hoy esa información va por WhatsApp y llega tarde — es el problema que el
 * cliente describió en la reunión, con la falla de cargadores que se supo recién
 * al turno siguiente. Por eso el botón no está escondido al final del formulario.
 *
 * Conectada de punta a punta (RFC "Supervisión en Terreno", Fases 4b+5): el
 * catálogo de equipos/operadores, las tarjetas de turno (apertura/cierre) y
 * el reporte de salida en PDF salen todos de `useShiftRegister()` — online
 * y sin señal por igual, vía el outbox de Dexie (`offline/outbox.ts`/
 * `offline/replay.ts`). El JSX de acá abajo no cambió desde la maqueta
 * original, solo la capa de estado.
 */

const fmt = (n: number | undefined, dec = 1) =>
  n == null ? '—' : n.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export function RegistroEquipoView() {
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);
  const enLinea = useOnlineStatus();

  const {
    ctx,
    anterior,
    turnoSeleccion,
    siguienteTurno,
    avanzarTurno,
    volverTurnoActual,
    mostrarSelectorTurno,
    supervisor,
    veTodo,
    disponibles,
    equipoHint,
    operadores,
    abiertasActual,
    abiertasAnterior,
    cerradas,
    enCurso,
    apertura,
    setApertura,
    equipoElegido,
    valorInicialApertura,
    abrir: agregarEquipo,
    isAbriendo,
    setCerrandoId,
    cerrando,
    cierre,
    setCierre,
    abrirCierre,
    cerrar: confirmarCierre,
    finalNum,
    horasMaquina,
    finalInvalido,
    adBlueCierre,
    adBlueIncompletoCierre,
    edicion,
    isCerrando,
    foto,
    verReporte,
    setVerReporte,
    historialAbierto,
    setHistorialAbierto,
    detalleCerrada,
    setDetalleCerrada,
    reporteEstado,
    reporteUltimo,
    reporteError,
    reportePuedeReenviar,
    enviarReporte,
    isEnviandoReporte,
    reporteUrl,
  } = useShiftRegister();

  // --- Apertura -------------------------------------------------------------

  const formApertura = (
    <Card>
      <CardHead titulo="Abrir equipo" bajada="Se agrega a la lista como tarjeta «En curso»." />
      {disponibles.length === 0 ? (
        <Hint>Todos los equipos operativos ya tienen una tarjeta abierta en este turno.</Hint>
      ) : (
        <Form>
          <Campo label="Equipo" hint={equipoHint}>
            <Selector
              etiqueta="Equipo"
              tituloTabular
              valor={equipoElegido?.id ?? ''}
              onChange={(id) => {
                const eq = disponibles.find((x) => x.id === id);
                setApertura((a) => ({
                  ...a,
                  equipoId: id,
                  horometro: eq?.currentHourmeter != null ? fmt(eq.currentHourmeter) : '',
                }));
              }}
              opciones={disponibles.map((e) => ({ valor: e.id, titulo: e.internalCode, detalle: e.type }))}
            />
          </Campo>

          <Campo label="Operador">
            <Selector
              etiqueta="Operador"
              valor={apertura.operatorId}
              onChange={(operatorId) => setApertura((a) => ({ ...a, operatorId }))}
              opciones={operadores.map((o) => ({ valor: o.id, titulo: o.name }))}
            />
          </Campo>

          <Campo
            label="Horómetro inicial"
            unidad="h"
            hint={
              equipoElegido?.currentHourmeter != null ? (
                <>
                  Último registrado: <b className="tabular">{fmt(equipoElegido.currentHourmeter)} h</b>
                </>
              ) : (
                'Sin lectura previa para este equipo.'
              )
            }
          >
            <Input
              numerico
              value={apertura.horometro}
              placeholder={equipoElegido?.currentHourmeter != null ? fmt(equipoElegido.currentHourmeter) : '0'}
              onChange={(e) => setApertura((a) => ({ ...a, horometro: e.target.value }))}
            />
          </Campo>

          {/* Turno, fecha y supervisor ya no van acá abajo como tres renglones
              «automáticos»: son la cabecera de la pantalla. Lo que queda es el
              recordatorio de a qué turno se está agregando, porque el
              formulario puede quedar a media pantalla del encabezado. */}
          <Hint>
            Se agrega al turno <b>{ctx.turno}</b> del <b>{ctx.fechaCorta}</b>, a nombre de{' '}
            <b>{supervisor}</b>.
          </Hint>

          <Boton
            ancho
            onClick={agregarEquipo}
            disabled={!apertura.operatorId || isAbriendo || valorInicialApertura == null}
          >
            {isAbriendo ? 'Abriendo…' : 'Agregar equipo'} <ArrowRight className="h-[19px] w-[19px]" />
          </Boton>
          {!apertura.operatorId && (
            <p className="m-0 text-center text-[12.5px] text-muted-foreground">
              Elegí el operador para agregar el equipo.
            </p>
          )}
        </Form>
      )}
    </Card>
  );

  // --- Reporte de salida (conectado al outbox offline) --------------

  /**
   * Estilo por estado: mientras "enviado" no estaba conectado al servidor,
   * usaba el mismo ámbar/`Clock` que "en cola" a propósito, para no insinuar
   * una entrega que no había ocurrido. Ahora que el servidor lo confirma de
   * verdad, cada estado
   * vuelve a tener su propio color — el mismo criterio que ya usa
   * `reporteChip` (éxito/amarillo/rojo), aplicado también al fondo del
   * panel y de la barra flotante. `'sin-enviar'` sigue aparte: usa el color
   * de marca (`--terreno-head`) para el llamado a la acción, no un tono
   * semántico.
   */
  const REPORTE_ESTILO: Record<
    Exclude<EstadoReporte, 'sin-enviar'>,
    { fondo: string; texto: string; borde: string; Icono: typeof Clock }
  > = {
    'en-cola': {
      fondo: 'bg-[var(--warning-soft)]',
      texto: 'text-[var(--warning-soft-foreground)]',
      borde: 'border-[1.5px] border-[#f1d9a2]',
      Icono: Clock,
    },
    'requiere-atencion': {
      fondo: 'bg-[var(--danger-soft)]',
      texto: 'text-[var(--danger)]',
      borde: 'border-[1.5px] border-[#f3c9c9]',
      Icono: AlertTriangle,
    },
    enviado: {
      fondo: 'bg-[var(--success-soft)]',
      texto: 'text-[var(--success-soft-foreground)]',
      borde: 'border-[1.5px] border-[#bfe3cd]',
      Icono: CheckCircle2,
    },
  };
  const esUrgente = reporteEstado === 'sin-enviar';
  const estiloReporte = esUrgente ? null : REPORTE_ESTILO[reporteEstado];

  /** Chip + línea de resumen por estado — la misma lectura en el panel de
   * escritorio y en la barra flotante de teléfono/tablet. */
  const reporteChip =
    reporteEstado === 'enviado' ? (
      <Chip tono="success">Enviado</Chip>
    ) : reporteEstado === 'en-cola' ? (
      <Chip tono="warning">En cola</Chip>
    ) : reporteEstado === 'requiere-atencion' ? (
      <Chip tono="danger">Requiere atención</Chip>
    ) : (
      <Chip tono="danger">Sin enviar</Chip>
    );

  const reporteResumen =
    reporteEstado === 'enviado' && reporteUltimo ? (
      <>
        Preparado a las <b className="tabular">{fmtTime(reporteUltimo.requestedAt)}</b> con{' '}
        <b>{plural(reporteUltimo.cardCount, 'equipo', 'equipos')}</b>. {lineaEstadoCorreo(reporteUltimo.emailStatus)}.
        {reportePuedeReenviar && ' Se agregaron equipos desde entonces.'}
      </>
    ) : reporteEstado === 'en-cola' ? (
      <>
        <b>{plural(enCurso.length, 'equipo', 'equipos')}</b>. En cola: se enviará solo cuando vuelva la señal.
      </>
    ) : reporteEstado === 'requiere-atencion' ? (
      <>{reporteError?.message ?? 'El servidor rechazó el reporte — revisá el detalle en el panel de sincronización.'}</>
    ) : (
      <>
        <b className="text-white">{plural(enCurso.length, 'equipo', 'equipos')}</b> salieron en este turno y la
        administración todavía no lo sabe.
      </>
    );

  const panelReporte = (
    <div
      className={`flex flex-col gap-3 rounded-3xl p-[18px] ${
        estiloReporte ? `${estiloReporte.borde} ${estiloReporte.fondo} ${estiloReporte.texto}` : 'text-white'
      }`}
      style={esUrgente ? { background: 'var(--terreno-head)' } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11.5px] font-bold tracking-[0.08em] uppercase ${esUrgente ? 'text-white/70' : ''}`}>
          Reporte de salida
        </span>
        <div className="flex items-center gap-1.5">
          {estiloReporte && <estiloReporte.Icono className="h-[15px] w-[15px]" />}
          {reporteChip}
        </div>
      </div>
      <p className={`m-0 text-sm leading-snug ${esUrgente ? 'text-white/85' : ''}`}>{reporteResumen}</p>
      {reporteEstado === 'sin-enviar' ? (
        <>
          <Boton variante="acento" ancho className="min-h-[60px] !rounded-[18px] !text-[17px] shadow-[0_0_0_4px_rgba(29,78,216,.35)]" onClick={() => setVerReporte(true)}>
            Enviar reporte de salida <ArrowRight className="h-[19px] w-[19px]" />
          </Boton>
          <p className="m-0 text-[12.5px] text-white/85">
            Aviso en el sistema y correo con el PDF a la administración.
          </p>
        </>
      ) : (
        <Boton variante="contorno" ancho className="!min-h-10 !text-[13.5px]" onClick={() => setVerReporte(true)}>
          Ver reporte
        </Boton>
      )}
    </div>
  );

  /**
   * En teléfono y tablet el reporte no cabe en la columna: va como tarjeta
   * flotante, pegada abajo mientras se scrollea.
   *
   * Flota sobre la barra de pestañas, no en `bottom-0`: esa barra también es
   * `sticky bottom-0` y le gana en z-index, así que ahí el botón quedaba tapado
   * justo mientras había tarjetas que mirar. 78 px = los 66 de la barra de
   * pestañas + 12 de aire.
   */
  const FLOTANTE = 'sticky bottom-[78px] z-10 mt-4 rounded-3xl shadow-[0_10px_30px_rgba(13,12,10,.22)]';
  const barraReporte =
    reporteEstado === 'sin-enviar' ? (
      <div className={`${FLOTANTE} px-4 py-3 text-white`} style={{ background: 'var(--terreno-head)' }}>
        <div className="flex items-center gap-2 text-[12.5px] text-white/80">
          <i className="h-2 w-2 shrink-0 rounded-full bg-[#ff6b5a]" />
          <span>
            <b className="text-white">{plural(enCurso.length, 'equipo', 'equipos')}</b> salieron y la administración
            aún no lo sabe.
          </span>
        </div>
        <Boton variante="acento" ancho className="mt-2 min-h-[60px] !rounded-[18px] !text-[17px]" onClick={() => setVerReporte(true)}>
          Enviar reporte de salida <ArrowRight className="h-[19px] w-[19px]" />
        </Boton>
      </div>
    ) : (
      estiloReporte && (
        <div
          className={`${FLOTANTE} flex items-center gap-2.5 ${estiloReporte.borde} ${estiloReporte.fondo} px-4 py-3 text-sm font-semibold ${estiloReporte.texto}`}
        >
          <estiloReporte.Icono className="h-[18px] w-[18px] shrink-0" />
          <span className="flex-1">
            {reporteEstado === 'enviado' && reporteUltimo && (
              <>
                Reporte enviado · {fmtTime(reporteUltimo.requestedAt)} ·{' '}
                {plural(reporteUltimo.cardCount, 'equipo', 'equipos')}
              </>
            )}
            {reporteEstado === 'en-cola' && (
              <>En cola · se enviará al volver la señal · {plural(enCurso.length, 'equipo', 'equipos')}</>
            )}
            {reporteEstado === 'requiere-atencion' && 'Reporte con error — revisá el panel de sincronización'}
          </span>
          <Boton variante="contorno" className="!min-h-10 !text-[13.5px]" onClick={() => setVerReporte(true)}>
            Ver
          </Boton>
        </div>
      )
    );

  // --- Historial ------------------------------------------------------------

  /** «Editar» de una tarjeta, abierta o cerrada. Deshabilitado, dice por qué. */
  const botonEditar = (t: TarjetaTurno, ancho: boolean) => {
    const motivo = edicion.motivoSinEdicion(t);
    return (
      <Boton
        variante="contorno"
        ancho={ancho}
        className="!min-h-10 !text-[13.5px]"
        aria-label={`Editar tarjeta de ${t.equipo}${motivo ? `. ${motivo}` : ''}`}
        title={motivo ?? undefined}
        disabled={motivo != null}
        onClick={() => edicion.abrirEdicion(t.id)}
      >
        <Pencil className="h-4 w-4" /> Editar
      </Boton>
    );
  };

  const tarjeta = (t: TarjetaTurno) => {
    const cerrada = t.estado === 'cerrada';
    // Sin borde izquierdo de color: la tarjeta vive dentro del `BloqueTurno`,
    // que ya dice de qué turno es, y un borde grueso sobre esquinas de 24 px
    // se doblaba en una media luna.
    return (
      <Tarjeta
        key={t.id}
        className={t.arrastrada ? 'outline-2 outline-offset-[3px] outline-dashed outline-[var(--terreno-offline)]' : ''}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div>
            <div className="tabular text-[19px] font-semibold tracking-[-0.01em]">{t.equipo}</div>
            <div className="text-[13px] text-muted-foreground">{t.tipo}</div>
          </div>
          <Chip tono={cerrada ? 'success' : 'info'}>{cerrada ? 'Cerrada' : 'En curso'}</Chip>
        </div>
        <div className="flex items-center gap-2 font-medium">
          <User className="h-[17px] w-[17px] text-muted-foreground" />
          {t.operador}
        </div>
        <Cifras
          items={[
            { label: 'Inicial', valor: fmt(t.inicial) },
            { label: 'Final', valor: fmt(t.final) },
            { label: 'Horas', valor: cerrada ? fmt(t.final! - t.inicial) : '—', destacado: true },
            { label: 'Litros', valor: t.litros != null ? fmt(t.litros, 0) : '—' },
          ]}
        />
        {cerrada ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--success-soft-foreground)]">
              <Camera className="h-4 w-4" />
              Foto del surtidor
            </span>
            <span>· cerrada {t.cerradaA}</span>
          </div>
        ) : (
          <Boton variante="contorno" ancho onClick={() => abrirCierre(t.id)}>
            Cerrar tarjeta <ArrowRight className="h-[19px] w-[19px]" />
          </Boton>
        )}
        {botonEditar(t, true)}
        {t.edicionSinSincronizar && <MarcaSinSincronizar edicion requiereAtencion={t.edicionRequiereAtencion} />}
        {t.sinSincronizar && (
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--warning-soft-foreground)]">
            <Clock className="h-[15px] w-[15px]" />
            Guardada en el equipo · falta sincronizar
          </div>
        )}
        {t.arrastrada && (
          <Hint>
            Quedó en curso al terminar el turno anterior. Falta definir con el cliente si sigue abierta, se cierra sola
            o la cierra el administrador.
          </Hint>
        )}
      </Tarjeta>
    );
  };

  const filas = (ts: TarjetaTurno[]) =>
    ts.map((t) => {
      const cerrada = t.estado === 'cerrada';
      return (
        <tr key={t.id} className={t.arrastrada ? 'bg-[#fffaf0]' : ''}>
          <td className={TD}>
            <b className="tabular block text-[15px] font-semibold">{t.equipo}</b>
            <span className="text-[12.5px] text-muted-foreground">{t.tipo}</span>
          </td>
          <td className={TD}>
            {t.operador}
            {t.sinSincronizar && (
              <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--warning-soft-foreground)]">
                <Clock className="h-[15px] w-[15px]" />
                Sin sincronizar
              </div>
            )}
            {t.edicionSinSincronizar && <MarcaSinSincronizar edicion requiereAtencion={t.edicionRequiereAtencion} />}
          </td>
          <td className={`${TD} tabular text-right`}>{fmt(t.inicial)}</td>
          <td className={`${TD} tabular text-right`}>{fmt(t.final)}</td>
          <td className={`${TD} tabular text-right font-semibold`}>{cerrada ? fmt(t.final! - t.inicial) : '—'}</td>
          <td className={`${TD} tabular text-right`}>{t.litros != null ? fmt(t.litros, 0) : '—'}</td>
          <td className={TD}>
            {cerrada ? <Camera className="h-4 w-4 text-[var(--success-soft-foreground)]" /> : <span className="text-[#9aa2ad]">—</span>}
          </td>
          <td className={TD}>
            <Chip tono={cerrada ? 'success' : 'info'}>{cerrada ? 'Cerrada' : 'En curso'}</Chip>
          </td>
          <td className={`${TD} text-right`}>
            <div className="flex justify-end gap-2">
              {botonEditar(t, false)}
              {!cerrada && (
                <Boton variante="contorno" className="!min-h-10 !text-[13.5px]" onClick={() => abrirCierre(t.id)}>
                  Cerrar
                </Boton>
              )}
            </div>
          </td>
        </tr>
      );
    });

  const encabezados = (
    <thead>
      <tr>
        {/* «Horóm. inicial / final» eran los títulos más anchos de la tabla y
            forzaban el scroll. La sección ya habla de horómetros: el contexto
            lo da el encabezado del grupo, no cada columna. */}
        <th className={TH}>Equipo</th>
        <th className={TH}>Operador</th>
        <th className={`${TH} text-right`}>Inicial</th>
        <th className={`${TH} text-right`}>Final</th>
        <th className={`${TH} text-right`}>Horas</th>
        <th className={`${TH} text-right`}>Litros</th>
        <th className={TH}>Foto</th>
        <th className={TH}>Estado</th>
        <th className={TH} />
      </tr>
    </thead>
  );

  const fechaAnterior = fechaCorta(anterior.fecha);

  /** «Luis Contreras · Turno DIURNO mié 24/09» — a qué turno pertenece la
   *  tarjeta que se está cerrando, que puede no ser el turno en curso. */
  const bajadaCierre = cerrando
    ? `${cerrando.operador} · Turno ${
        cerrando.grupo === 'actual'
          ? `${ctx.turno} ${ctx.fechaCorta}`
          : `${anterior.turno} ${fechaAnterior}`
      }`
    : '';

  /**
   * Un bloque de turno: separador + tarjetas (o tabla en escritorio). Los dos
   * turnos se dibujan igual, así que la diferencia que ve el supervisor es
   * solo el color y el icono — no dos diseños distintos que haya que aprender.
   */
  const bloque = (turno: Turno, fecha: string, ts: TarjetaTurno[], vacio: string) =>
    esEscritorio ? (
      <Tabla
        key={`${turno}-${fecha}`}
        turno={turno}
        titulo={`TURNO ${turno} · ${fecha}`}
        detalle={ts.length ? plural(ts.length, 'tarjeta', 'tarjetas') : undefined}
      >
        {encabezados}
        <tbody>
          {ts.length ? (
            filas(ts)
          ) : (
            <tr>
              <td className={`${TD} text-muted-foreground`} colSpan={9}>
                {vacio}
              </td>
            </tr>
          )}
        </tbody>
      </Tabla>
    ) : (
      <BloqueTurno
        key={`${turno}-${fecha}`}
        turno={turno}
        fecha={fecha}
        detalle={ts.length ? plural(ts.length, 'tarjeta', 'tarjetas') : undefined}
      >
        {ts.length ? (
          ts.map(tarjeta)
        ) : (
          <p className="m-0 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
            {vacio}
          </p>
        )}
      </BloqueTurno>
    );

  /**
   * R4: la lista es la de tarjetas ABIERTAS. Las cerradas ya no piden nada al
   * supervisor y son las que más crecen —al final de un turno son todas—, así
   * que viven detrás de un botón en vez de empujar hacia abajo lo único sobre
   * lo que todavía hay que actuar.
   */
  const historial = (
    <>
      {/* El historial de cerradas se abre en una ventana, igual que el de
          Reporte diario: las cerradas ya no piden nada y no tienen por qué
          empujar hacia abajo las que siguen abiertas. */}
      <Boton
        variante="contorno"
        ancho
        onClick={() => {
          setDetalleCerrada(null);
          setHistorialAbierto(true);
        }}
      >
        <History className="h-[19px] w-[19px]" /> Ver historial de cerradas
        <span className="tabular font-medium text-muted-foreground">· {cerradas.length}</span>
      </Boton>

      {bloque(
        ctx.turno,
        ctx.fechaCorta,
        abiertasActual,
        veTodo ? 'Sin tarjetas abiertas en este turno.' : 'No tenés tarjetas abiertas en este turno.',
      )}

      {abiertasAnterior.length > 0 &&
        bloque(anterior.turno, fechaAnterior, abiertasAnterior, '')}
    </>
  );

  // --- Historial de cerradas (ventana) --------------------------------------

  /** A qué turno pertenece una tarjeta, con su fecha: `DIURNO lun 28-09`. */
  const turnoDe = (t: TarjetaTurno) =>
    t.grupo === 'actual' ? `${ctx.turno} ${ctx.fechaCorta}` : `${anterior.turno} ${fechaAnterior}`;

  const listaCerradas =
    cerradas.length === 0 ? (
      <p className="m-0 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Todavía no cerraste ninguna tarjeta.
      </p>
    ) : (
      [
        { turno: ctx.turno, fecha: ctx.fechaCorta, grupo: 'actual' as const },
        { turno: anterior.turno, fecha: fechaAnterior, grupo: 'anterior' as const },
      ]
        .map((g) => ({ ...g, ts: cerradas.filter((t) => t.grupo === g.grupo) }))
        .filter((g) => g.ts.length > 0)
        .map((g) => (
          <div key={g.grupo} className="flex flex-col gap-2.5">
            <GrupoHead
              titulo={`TURNO ${g.turno} · ${g.fecha}`}
              detalle={plural(g.ts.length, 'tarjeta', 'tarjetas')}
            />
            {g.ts.map((t) => (
              <Tarjeta key={t.id}>
                <div className="flex items-start justify-between gap-2.5">
                  <div>
                    <div className="tabular text-[17px] font-semibold tracking-[-0.01em]">{t.equipo}</div>
                    <div className="text-[13px] text-muted-foreground">
                      {t.tipo} · {t.operador}
                    </div>
                  </div>
                  <Chip tono="success">Cerrada</Chip>
                </div>
                <Cifras
                  items={[
                    { label: 'Inicial', valor: fmt(t.inicial) },
                    { label: 'Final', valor: fmt(t.final) },
                    { label: 'Horas', valor: fmt(t.final! - t.inicial), destacado: true },
                    { label: 'Litros', valor: fmt(t.litros, 0) },
                    { label: 'AdBlue', valor: t.adBlue ? fmt(t.adBlueLitros, 0) : '—' },
                  ]}
                />
                {t.edicionSinSincronizar && (
                  <MarcaSinSincronizar edicion requiereAtencion={t.edicionRequiereAtencion} />
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-muted-foreground">
                    Cerrada a las <span className="tabular">{t.cerradaA}</span>
                  </span>
                  <div className="flex gap-2">
                    {botonEditar(t, false)}
                    <Boton variante="contorno" className="!min-h-10 !text-[13.5px]" onClick={() => setDetalleCerrada(t)}>
                      Ver detalle <ChevronRight className="h-4 w-4" />
                    </Boton>
                  </div>
                </div>
              </Tarjeta>
            ))}
          </div>
        ))
    );

  const vistaDetalleCerrada = detalleCerrada && (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Boton variante="contorno" onClick={() => setDetalleCerrada(null)}>
          <ArrowLeft className="h-[18px] w-[18px]" /> Volver al historial
        </Boton>
        {botonEditar(detalleCerrada, false)}
      </div>
      {detalleCerrada.edicionSinSincronizar && (
        <MarcaSinSincronizar edicion requiereAtencion={detalleCerrada.edicionRequiereAtencion} />
      )}

      <Cifras
        items={[
          { label: 'Inicial', valor: fmt(detalleCerrada.inicial) },
          { label: 'Final', valor: fmt(detalleCerrada.final) },
          { label: 'Horas', valor: fmt(detalleCerrada.final! - detalleCerrada.inicial), destacado: true },
          { label: 'Litros', valor: fmt(detalleCerrada.litros, 0) },
          { label: 'AdBlue', valor: detalleCerrada.adBlue ? fmt(detalleCerrada.adBlueLitros, 0) : '—' },
        ]}
      />

      <div className="flex flex-col gap-1.5">
        <GrupoHead titulo="Tarjeta" />
        <Filas
          filas={[
            ['Equipo', `${detalleCerrada.equipo} · ${detalleCerrada.tipo}`],
            ['Operador', detalleCerrada.operador],
            ['Turno', turnoDe(detalleCerrada)],
            ['Supervisor', detalleCerrada.supervisor],
            ['Cerrada a las', detalleCerrada.cerradaA ?? '—'],
            ['AdBlue', detalleCerrada.adBlue ? `Sí · ${fmt(detalleCerrada.adBlueLitros, 1)} L` : 'No cargó'],
            [
              'Foto del surtidor',
              <span key="foto" className="inline-flex items-center gap-1.5 text-[var(--success-soft-foreground)]">
                <Camera className="h-4 w-4" /> Adjunta
              </span>,
            ],
          ]}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <GrupoHead titulo="Observaciones" />
        <p className="m-0 rounded-2xl border border-border bg-[#fafbfc] px-3 py-2.5 text-[14.5px]">
          {detalleCerrada.observaciones?.trim() || (
            <span className="text-muted-foreground">Sin observaciones.</span>
          )}
        </p>
      </div>
    </div>
  );

  /** Operadores activos, más el de la tarjeta si ya no lo está: se puede dejar, no elegir de nuevo. */
  const opcionesOperadorEdicion = operadores.map((o) => ({ valor: o.id, titulo: o.name }));
  const operadorActual = edicion.editando;
  if (operadorActual?.operatorId && !opcionesOperadorEdicion.some((o) => o.valor === operadorActual.operatorId)) {
    opcionesOperadorEdicion.unshift({ valor: operadorActual.operatorId, titulo: operadorActual.operador });
  }

  // --- Cierre de tarjeta ----------------------------------------------------

  const formularioCierre = cerrando && (
    <>
      <div className="flex items-center justify-between rounded-2xl bg-[#f3f4f6] px-3.5 py-3">
        <Label>Horómetro inicial</Label>
        <b className="tabular text-[17px] font-medium">{fmt(cerrando.inicial)} h</b>
      </div>

      <Campo label="Horómetro final" requerido unidad="h">
        <Input numerico value={cierre.final} onChange={(e) => setCierre((c) => ({ ...c, final: e.target.value }))} />
      </Campo>
      {finalInvalido && (
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
        valor={horasMaquina != null && horasMaquina >= 0 ? `${fmt(horasMaquina)} h` : '—'}
      />

      <Campo label="Combustible cargado" requerido unidad="L" hint="Cero si no cargó en el turno.">
        <Input numerico value={cierre.litros} onChange={(e) => setCierre((c) => ({ ...c, litros: e.target.value }))} />
      </Campo>

      <AdBlueCampos
        adBlue={cierre.adBlue}
        litros={cierre.adBlueLitros}
        resultado={adBlueCierre}
        onAdBlue={(adBlue) => setCierre((c) => ({ ...c, adBlue }))}
        onLitros={(adBlueLitros) => setCierre((c) => ({ ...c, adBlueLitros }))}
      />

      {/*
        Foto, OCR y subida vienen enteros de Flota: el mismo bloque que usan
        la entrada, la salida y la carga de combustible. La foto del
        totalizador es el respaldo de la carga y el cliente la puso como
        obligatoria; sin ella el botón no se habilita, y la pantalla dice por
        qué en vez de dejar un botón apagado sin explicación.
      */}
      <FotoRespaldoField
        file={foto.file}
        isReadingPhoto={foto.isReadingPhoto}
        isUploadingPhoto={foto.isUploadingPhoto}
        captureDate={foto.captureDate}
        onSelect={foto.handleSelectPhoto}
        onClear={foto.handleClearPhoto}
        title="Foto del surtidor"
        subtitle="Debe verse el totalizador. Los litros se leen de la foto y quedan editables."
        staleQuestion="¿Es la carga de este turno?"
      />

      <Campo label="Observaciones">
        <Textarea
          rows={3}
          placeholder="Novedades del equipo durante el turno"
          value={cierre.observaciones}
          onChange={(e) => setCierre((c) => ({ ...c, observaciones: e.target.value }))}
        />
      </Campo>

      <Boton
        ancho
        onClick={confirmarCierre}
        disabled={
          !foto.file ||
          foto.isReadingPhoto ||
          foto.isUploadingPhoto ||
          isCerrando ||
          finalNum == null ||
          finalInvalido ||
          adBlueIncompletoCierre
        }
      >
        {foto.isUploadingPhoto ? 'Subiendo la foto…' : isCerrando ? 'Cerrando…' : 'Cerrar tarjeta'}
        <ArrowRight className="h-[19px] w-[19px]" />
      </Boton>
      {!foto.file && (
        <p className="m-0 text-center text-[12.5px] text-muted-foreground">
          Falta la foto del surtidor para cerrar.
        </p>
      )}
    </>
  );

  return (
    <>
      {/* Primero el turno, después el título: lo que el supervisor necesita
          confirmar de un vistazo es EN QUÉ turno está registrando, no en qué
          pantalla. Ver `CabeceraTurno`. */}
      <CabeceraTurno
        turno={ctx.turno}
        fecha={ctx.fechaCorta}
        hora={ctx.fechaHora}
        supervisor={supervisor}
        extra={
          <>
            {/* Selector turno actual/siguiente (RFC "Supervisión en
                Terreno" §Diseño): a las 07:30 el reloj todavía propone el
                NOCTURNO de anoche, pero el supervisor ya está empezando el
                DIURNO de hoy — este botón deja adelantarse UN turno sin
                esperar a las 08:00. Solo visible cerca del cambio de turno
                (o con el override ya activo, para poder volver) — fuera de
                esa ventana un toque accidental cargaría tarjetas en el
                turno equivocado (`mostrarSelectorTurno`). */}
            {mostrarSelectorTurno && (
              <button
                type="button"
                onClick={turnoSeleccion === 'siguiente' ? volverTurnoActual : avanzarTurno}
                className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold"
                style={{ background: 'rgba(255,255,255,.22)' }}
              >
                {turnoSeleccion === 'siguiente' ? 'Volver al turno del reloj' : `Adelantar a ${siguienteTurno}`}
              </button>
            )}
            <span
              className="inline-flex min-h-[32px] items-center rounded-full px-3"
              style={{ background: 'rgba(255,255,255,.22)' }}
            >
              Faena Patillo
            </span>
          </>
        }
      />

      {/* El chip "Sin modo offline" de la maqueta se retira acá: el modo
          offline ya existe y su estado real se ve en el `SyncStatus` del
          layout de Terreno — repetirlo acá sería redundante o, peor, quedar
          desactualizado. */}
      <VistaHead titulo="Registro de equipo" />

      <VistaSplit
        formulario={
          <>
            {/* En escritorio el cierre reemplaza al formulario de apertura en la
                misma columna; en teléfono y tablet se abre como hoja inferior. */}
            {esEscritorio && cerrando ? (
              <Card>
                <CardHead
                  titulo={
                    <>
                      <span className="tabular">{cerrando.equipo}</span> · {cerrando.tipo}
                    </>
                  }
                  bajada={bajadaCierre}
                  extra={
                    <button
                      type="button"
                      onClick={() => setCerrandoId(null)}
                      aria-label="Cancelar"
                      className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-[#eef0f2]"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  }
                />
                <Form>{formularioCierre}</Form>
              </Card>
            ) : (
              formApertura
            )}
            {esEscritorio && panelReporte}
          </>
        }
        historial={historial}
      />

      {!esEscritorio && barraReporte}

      {!esEscritorio && cerrando && (
        <Hoja
          eyebrow="Cerrar tarjeta"
          titulo={`${cerrando.equipo} · ${cerrando.tipo}`}
          bajada={bajadaCierre}
          onCerrar={() => setCerrandoId(null)}
        >
          <Form>{formularioCierre}</Form>
        </Hoja>
      )}

      {/* Lista y detalle son dos pantallas de la MISMA ventana, como en
          Reporte diario: dos modales apilados se pelean el foco. */}
      <ModalTerreno
        abierto={historialAbierto}
        onAbiertoChange={(abierto) => {
          setHistorialAbierto(abierto);
          if (!abierto) setDetalleCerrada(null);
        }}
        titulo={
          detalleCerrada ? `${detalleCerrada.equipo} · ${detalleCerrada.tipo}` : 'Historial de cerradas'
        }
        detalle={
          detalleCerrada
            ? `Turno ${turnoDe(detalleCerrada)} · cerrada a las ${detalleCerrada.cerradaA ?? '—'}`
            : `${plural(cerradas.length, 'tarjeta cerrada', 'tarjetas cerradas')} · este turno y el anterior`
        }
      >
        {vistaDetalleCerrada || listaCerradas}
      </ModalTerreno>

      <ModalTerreno
        abierto={edicion.editando != null}
        onAbiertoChange={(abierto) => !abierto && edicion.cerrarEdicion()}
        titulo={edicion.editando ? `Editar · ${edicion.editando.equipo} · ${edicion.editando.tipo}` : ''}
        detalle={edicion.editando ? turnoDe(edicion.editando) : undefined}
      >
        <EditorTarjeta edicion={edicion} operadores={opcionesOperadorEdicion} />
      </ModalTerreno>

      {verReporte && (
        <Hoja
          eyebrow="Reporte de salida de turno"
          titulo={reporteEstado === 'enviado' ? 'Reporte enviado' : 'Revisá y enviá'}
          bajada="Así lo recibe la administración, también en PDF."
          onCerrar={() => setVerReporte(false)}
        >
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="flex items-center justify-between gap-2.5 px-3.5 py-3 text-white" style={{ background: 'var(--terreno-head)' }}>
              <div>
                <b className="block text-sm">Transportes Optimiza SPA</b>
                <span className="text-[11.5px] tracking-[0.1em] text-white/65 uppercase">
                  Reporte de salida de turno
                </span>
              </div>
              <span className="tabular text-xs">PDF</span>
            </div>
            <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2 border-b border-border px-3.5 py-3 text-[13px]">
              {[
                ['Fecha', ctx.fecha.toLocaleDateString('es-CL')],
                ['Turno', ctx.etiqueta],
                ['Emitido', reporteUltimo ? fmtTime(reporteUltimo.requestedAt) : '—'],
                ['Supervisor', supervisor],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">{k}</dt>
                  <dd className="mt-px font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr>
                    <th className={TH}>Equipo</th>
                    <th className={TH}>Operador</th>
                    <th className={`${TH} text-right`}>Horóm. inicial</th>
                  </tr>
                </thead>
                <tbody>
                  {enCurso.map((t) => (
                    <tr key={t.id}>
                      <td className={TD}>
                        <b className="tabular block font-semibold">{t.equipo}</b>
                        <span className="text-[12.5px] text-muted-foreground">{t.tipo}</span>
                      </td>
                      <td className={TD}>{t.operador}</td>
                      <td className={`${TD} tabular text-right`}>{fmt(t.inicial)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl bg-[#f5f6f8] px-3 py-2.5 text-[13px] text-muted-foreground">
            <Mail className="h-[18px] w-[18px] shrink-0 text-foreground" />
            <span>
              <b className="text-foreground">Destinatarios:</b> la administración (aviso en el sistema y correo con
              el PDF adjunto). Nunca a los clientes finales de Optimiza.
            </span>
          </div>

          {reporteEstado === 'sin-enviar' && (
            <Boton
              variante="acento"
              ancho
              className="min-h-[60px] !rounded-[18px] !text-[17px]"
              disabled={isEnviandoReporte}
              onClick={() => {
                enviarReporte();
                setVerReporte(false);
              }}
            >
              {isEnviandoReporte ? 'Enviando…' : 'Enviar ahora'} <ArrowRight className="h-[19px] w-[19px]" />
            </Boton>
          )}

          {reporteEstado === 'en-cola' && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-[var(--warning-soft)] px-3.5 py-3 text-sm font-medium text-[var(--warning-soft-foreground)]">
              <Clock className="h-[18px] w-[18px] shrink-0" />
              En cola: se enviará solo cuando vuelva la señal.
            </div>
          )}

          {reporteEstado === 'requiere-atencion' && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-[var(--danger-soft)] px-3.5 py-3 text-sm font-medium text-[var(--danger)]">
              <AlertTriangle className="h-[18px] w-[18px] shrink-0" />
              {reporteError?.message ?? 'El servidor rechazó el reporte.'} Reintentá o descartalo desde el panel de
              sincronización.
            </div>
          )}

          {reporteEstado === 'enviado' && reporteUltimo && (
            <>
              <a
                href={reporteUrl(reporteUltimo.id)}
                target="_blank"
                rel="noopener"
                aria-disabled={!enLinea}
                onClick={(e) => {
                  if (!enLinea) e.preventDefault();
                }}
                className={`inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl px-5 text-[15.5px] font-semibold ${
                  enLinea
                    ? 'bg-secondary text-secondary-foreground hover:bg-black'
                    : 'cursor-not-allowed bg-[#c9ced6] text-white'
                }`}
              >
                <Download className="h-[19px] w-[19px]" /> Descargar PDF
              </a>
              {!enLinea && (
                <p className="m-0 text-center text-[12.5px] text-muted-foreground">
                  Necesitás señal para descargar el PDF.
                </p>
              )}
              {reportePuedeReenviar && (
                <Boton
                  variante="contorno"
                  ancho
                  disabled={isEnviandoReporte}
                  onClick={() => {
                    enviarReporte();
                    setVerReporte(false);
                  }}
                >
                  {isEnviandoReporte ? 'Enviando…' : `Reenviar con ${plural(enCurso.length, 'equipo', 'equipos')}`}{' '}
                  <ArrowRight className="h-[19px] w-[19px]" />
                </Boton>
              )}
            </>
          )}
        </Hoja>
      )}
    </>
  );
}
