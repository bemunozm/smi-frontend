import { useMemo, useState } from 'react';
import { ArrowRight, Camera, Check, Clock, Lock, Mail, User } from 'lucide-react';

import { useEquipment } from '../hooks/useEquipment';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import {
  Automatico,
  Automaticos,
  Boton,
  Calculado,
  Campo,
  Card,
  CardHead,
  Chip,
  ChipContexto,
  Cifras,
  Form,
  GrupoHead,
  Hint,
  Hoja,
  Input,
  Label,
  Select,
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
 * ⚠️ MAQUETA PARCIAL. El catálogo de equipos SÍ es real (sale de
 * `useEquipment()` y se filtra por estado operativo, que es la regla R1). Las
 * tarjetas del turno son de ejemplo: el modelo `turno` + `registro_equipo_turno`
 * no existe todavía, ni el reporte de salida en PDF. Nada de lo que se registra
 * acá se guarda.
 */

type Estado = 'curso' | 'cerrada';

interface TarjetaTurno {
  id: number;
  equipo: string;
  tipo: string;
  operador: string;
  inicial: number;
  final?: number;
  litros?: number;
  turno: 'D' | 'N';
  estado: Estado;
  cerradaA?: string;
  /** Registrada sin señal: está en el equipo, todavía no en el servidor. */
  sinSincronizar?: boolean;
  /** Quedó abierta al terminar el turno anterior — ver la nota de Q5. */
  arrastrada?: boolean;
}

const OPERADORES = [
  'Patricio Rojas',
  'Luis Contreras',
  'Marcelo Soto',
  'Cristian Araya',
  'Héctor Villalobos',
  'Sebastián Tapia',
  'Nicolás Espinoza',
  'Jorge Pizarro',
  'Rubén Carrasco',
  'Mauricio Olivares',
  'Felipe Gallardo',
];

const TARJETAS_EJEMPLO: TarjetaTurno[] = [
  { id: 1, equipo: 'CA-011', tipo: 'Cargador', operador: 'Patricio Rojas', inicial: 12487.3, turno: 'D', estado: 'curso' },
  { id: 2, equipo: 'PE-004', tipo: 'Perforadora', operador: 'Luis Contreras', inicial: 8412.6, turno: 'D', estado: 'curso' },
  { id: 3, equipo: 'EX-002', tipo: 'Excavadora', operador: 'Marcelo Soto', inicial: 6105.0, turno: 'D', estado: 'curso' },
  { id: 4, equipo: 'CM-015', tipo: 'Camión', operador: 'Cristian Araya', inicial: 21330.4, turno: 'D', estado: 'curso', sinSincronizar: true },
  { id: 5, equipo: 'CM-021', tipo: 'Camión', operador: 'Héctor Villalobos', inicial: 19876.2, turno: 'D', estado: 'curso', sinSincronizar: true },
  { id: 9, equipo: 'CA-007', tipo: 'Cargador', operador: 'Felipe Gallardo', inicial: 9940.5, turno: 'N', estado: 'curso', arrastrada: true },
  { id: 6, equipo: 'CA-011', tipo: 'Cargador', operador: 'Jorge Pizarro', inicial: 12475.8, final: 12487.3, litros: 186, turno: 'N', estado: 'cerrada', cerradaA: '07:48' },
  { id: 7, equipo: 'EX-002', tipo: 'Excavadora', operador: 'Rubén Carrasco', inicial: 6094.1, final: 6105.0, litros: 164, turno: 'N', estado: 'cerrada', cerradaA: '07:51' },
  { id: 8, equipo: 'CM-015', tipo: 'Camión', operador: 'Mauricio Olivares', inicial: 21319.2, final: 21330.4, litros: 95, turno: 'N', estado: 'cerrada', cerradaA: '07:55' },
];

const SUPERVISOR = 'Rodrigo Fuentes';

const fmt = (n: number | undefined, dec = 1) =>
  n == null ? '—' : n.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const aNumero = (s: string): number | null => {
  if (!s.trim()) return null;
  const v = Number.parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(v) ? null : v;
};

type EstadoReporte = 'sin-enviar' | 'enviado';

export function RegistroEquipoView() {
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);
  const { data: equipos = [] } = useEquipment();

  const [tarjetas, setTarjetas] = useState(TARJETAS_EJEMPLO);
  const [cerrandoId, setCerrandoId] = useState<number | null>(null);
  const [verReporte, setVerReporte] = useState(false);
  const [reporte, setReporte] = useState<EstadoReporte>('sin-enviar');
  const [reporteA, setReporteA] = useState<string | null>(null);

  const delDia = tarjetas.filter((t) => t.turno === 'D');
  const enCurso = delDia.filter((t) => t.estado === 'curso');
  const deNoche = tarjetas.filter((t) => t.turno === 'N');

  /**
   * R1: solo equipos operativos. Los que están en taller o fuera de servicio no
   * aparecen — y tampoco los que ya tienen una tarjeta abierta en este turno,
   * porque un equipo no sale dos veces a la vez.
   */
  const disponibles = useMemo(() => {
    const ocupados = new Set(enCurso.map((t) => t.equipo));
    return equipos.filter((e) => e.status === 'OPERATIONAL' && !ocupados.has(e.internalCode));
  }, [equipos, enCurso]);

  const enTaller = equipos.filter((e) => e.status !== 'OPERATIONAL');

  const [apertura, setApertura] = useState({ equipoId: '', operador: OPERADORES[5], horometro: '' });
  const equipoElegido = disponibles.find((e) => e.id === apertura.equipoId) ?? disponibles[0];

  const [cierre, setCierre] = useState({ final: '', litros: '', foto: false, observaciones: '' });

  const cerrando = tarjetas.find((t) => t.id === cerrandoId) ?? null;
  const finalNum = aNumero(cierre.final);
  const horasMaquina = cerrando && finalNum != null ? finalNum - cerrando.inicial : null;
  const finalInvalido = horasMaquina != null && horasMaquina < 0;

  const agregarEquipo = () => {
    if (!equipoElegido) return;
    setTarjetas((t) => [
      {
        id: Math.max(0, ...t.map((x) => x.id)) + 1,
        equipo: equipoElegido.internalCode,
        tipo: equipoElegido.type,
        operador: apertura.operador,
        inicial: aNumero(apertura.horometro) ?? equipoElegido.currentHourmeter ?? 0,
        turno: 'D',
        estado: 'curso',
      },
      ...t,
    ]);
    setApertura((a) => ({ ...a, equipoId: '', horometro: '' }));
  };

  const abrirCierre = (id: number) => {
    setCerrandoId(id);
    setCierre({ final: '', litros: '', foto: false, observaciones: '' });
  };

  const confirmarCierre = () => {
    if (!cerrando || finalNum == null || finalInvalido || !cierre.foto) return;
    setTarjetas((ts) =>
      ts.map((t) =>
        t.id === cerrando.id
          ? {
              ...t,
              estado: 'cerrada',
              final: finalNum,
              litros: aNumero(cierre.litros) ?? 0,
              cerradaA: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
            }
          : t,
      ),
    );
    setCerrandoId(null);
  };

  // --- Apertura -------------------------------------------------------------

  const formApertura = (
    <Card>
      <CardHead titulo="Abrir equipo" bajada="Se agrega a la lista como tarjeta «En curso»." />
      {disponibles.length === 0 ? (
        <Hint>Todos los equipos operativos ya tienen una tarjeta abierta en este turno.</Hint>
      ) : (
        <Form>
          <Campo
            label="Equipo"
            hint={
              enTaller.length > 0
                ? `Solo equipos operativos. ${enTaller.length === 1 ? `${enTaller[0].internalCode} no aparece porque no está operativo.` : `${enTaller.length} equipos no aparecen porque no están operativos.`}`
                : 'Solo equipos operativos.'
            }
          >
            <Select
              value={equipoElegido?.id ?? ''}
              onChange={(e) => {
                const eq = disponibles.find((x) => x.id === e.target.value);
                setApertura((a) => ({
                  ...a,
                  equipoId: e.target.value,
                  horometro: eq?.currentHourmeter != null ? fmt(eq.currentHourmeter) : '',
                }));
              }}
            >
              {disponibles.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.internalCode} · {e.type}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo label="Operador">
            <Select value={apertura.operador} onChange={(e) => setApertura((a) => ({ ...a, operador: e.target.value }))}>
              {OPERADORES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
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

          {/* El supervisor firma este registro: tiene que ver con qué turno,
              qué fecha y a nombre de quién queda, aunque no los edite. */}
          <Automaticos>
            <Automatico label="Turno" valor="DIURNO · 08–20" />
            <Automatico label="Fecha" valor={<span className="tabular text-[14.5px]">24/09/2026 08:35</span>} />
            <Automatico
              label="Supervisor"
              valor={SUPERVISOR}
              nota="No editable"
            />
          </Automaticos>

          <Boton ancho onClick={agregarEquipo}>
            Agregar equipo <ArrowRight className="h-[19px] w-[19px]" />
          </Boton>
        </Form>
      )}
    </Card>
  );

  // --- Reporte de salida ----------------------------------------------------

  const panelReporte = (
    <div
      className={`flex flex-col gap-3 rounded-3xl p-[18px] ${
        reporte === 'enviado'
          ? 'border-[1.5px] border-[#b6e2c5] bg-[var(--success-soft)] text-[var(--success-soft-foreground)]'
          : 'text-white'
      }`}
      style={reporte === 'enviado' ? undefined : { background: 'var(--terreno-head)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[11.5px] font-bold tracking-[0.08em] uppercase ${
            reporte === 'enviado' ? '' : 'text-white/70'
          }`}
        >
          Reporte de salida
        </span>
        {reporte === 'enviado' ? <Chip tono="success">Enviado</Chip> : <Chip tono="danger">Sin enviar</Chip>}
      </div>
      <p className={`m-0 text-sm leading-snug ${reporte === 'enviado' ? '' : 'text-white/85'}`}>
        {reporte === 'enviado' ? (
          <>
            Enviado a las <b className="tabular">{reporteA}</b> con <b>{enCurso.length} equipos</b>. Lo recibieron el
            administrador y Sergio Torres.
          </>
        ) : (
          <>
            <b className="text-white">{enCurso.length} equipos</b> salieron en este turno y la administración todavía no
            lo sabe.
          </>
        )}
      </p>
      {reporte === 'sin-enviar' ? (
        <>
          <Boton variante="acento" ancho className="min-h-[60px] !rounded-[18px] !text-[17px] shadow-[0_0_0_4px_rgba(29,78,216,.35)]" onClick={() => setVerReporte(true)}>
            Enviar reporte de salida <ArrowRight className="h-[19px] w-[19px]" />
          </Boton>
          <p className="m-0 text-[12.5px] text-white/85">
            Aviso en el sistema y correo con el PDF al administrador y a Sergio Torres.
          </p>
        </>
      ) : (
        <Boton variante="contorno" ancho className="!min-h-10 !text-[13.5px]" onClick={() => setVerReporte(true)}>
          Ver reporte
        </Boton>
      )}
    </div>
  );

  /** En teléfono y tablet el reporte no cabe en la columna: va como barra fija. */
  const barraReporte =
    reporte === 'sin-enviar' ? (
      <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-black px-4 py-3 text-white" style={{ background: 'var(--terreno-head)' }}>
        <div className="flex items-center gap-2 text-[12.5px] text-white/80">
          <i className="h-2 w-2 shrink-0 rounded-full bg-[#ff6b5a]" />
          <span>
            <b className="text-white">{enCurso.length} equipos</b> salieron y la administración aún no lo sabe.
          </span>
        </div>
        <Boton variante="acento" ancho className="mt-2 min-h-[60px] !rounded-[18px] !text-[17px]" onClick={() => setVerReporte(true)}>
          Enviar reporte de salida <ArrowRight className="h-[19px] w-[19px]" />
        </Boton>
      </div>
    ) : (
      <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex items-center gap-2.5 border-t border-[#b6e2c5] bg-[var(--success-soft)] px-4 py-3 text-sm font-semibold text-[var(--success-soft-foreground)]">
        <Check className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1">
          Reporte enviado a las <span className="tabular">{reporteA}</span> · {enCurso.length} equipos
        </span>
        <Boton variante="contorno" className="!min-h-10 !text-[13.5px]" onClick={() => setVerReporte(true)}>
          Ver
        </Boton>
      </div>
    );

  // --- Historial ------------------------------------------------------------

  const tarjeta = (t: TarjetaTurno) => {
    const cerrada = t.estado === 'cerrada';
    return (
      <Tarjeta key={t.id} className={t.arrastrada ? 'outline-2 outline-offset-[3px] outline-dashed outline-[var(--terreno-offline)]' : ''}>
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
            {!cerrada && (
              <Boton variante="contorno" className="!min-h-10 !text-[13.5px]" onClick={() => abrirCierre(t.id)}>
                Cerrar
              </Boton>
            )}
          </td>
        </tr>
      );
    });

  const encabezados = (
    <thead>
      <tr>
        <th className={TH}>Equipo</th>
        <th className={TH}>Operador</th>
        <th className={`${TH} text-right`}>Horóm. inicial</th>
        <th className={`${TH} text-right`}>Horóm. final</th>
        <th className={`${TH} text-right`}>Horas</th>
        <th className={`${TH} text-right`}>Litros</th>
        <th className={TH}>Foto</th>
        <th className={TH}>Estado</th>
        <th className={TH} />
      </tr>
    </thead>
  );

  const resumenDia = `${enCurso.length} en curso${delDia.length - enCurso.length ? ` · ${delDia.length - enCurso.length} cerradas` : ''}`;
  const abiertasNoche = deNoche.filter((t) => t.estado === 'curso').length;
  const resumenNoche = `${deNoche.length - abiertasNoche} cerradas${abiertasNoche ? ` · ${abiertasNoche} sin cerrar` : ''}`;

  const historial = esEscritorio ? (
    <>
      <Tabla titulo="Turno DIURNO · mié 24/09" detalle={resumenDia}>
        {encabezados}
        <tbody>{filas(delDia)}</tbody>
      </Tabla>
      <Tabla titulo="Turno NOCTURNO · mar 23/09" detalle={resumenNoche}>
        {encabezados}
        <tbody>{filas(deNoche)}</tbody>
      </Tabla>
    </>
  ) : (
    <>
      <GrupoHead titulo="Turno DIURNO · mié 24/09" detalle={resumenDia} />
      <div className="flex flex-col gap-3">{delDia.map(tarjeta)}</div>
      <GrupoHead titulo="Turno NOCTURNO · mar 23/09" detalle={resumenNoche} />
      <div className="flex flex-col gap-3">{deNoche.map(tarjeta)}</div>
    </>
  );

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

      {/* La foto del totalizador es el respaldo de la carga y el cliente la puso
          como obligatoria. Sin ella el botón no se habilita — y la pantalla
          dice por qué, en vez de dejar un botón apagado sin explicación. */}
      <div className="flex flex-col gap-1.5">
        <Label requerido>Foto del surtidor</Label>
        {cierre.foto ? (
          <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#6a747e] to-[#2d3338]">
            <div className="rounded-lg border-[3px] border-[#1f2a22] bg-[#0e1a12] px-3.5 py-2 text-[26px] tracking-wider text-[#9be7a8]" style={{ fontFamily: 'var(--font-mono)' }}>
              <small className="block text-[10px] tracking-[0.14em] text-[#6fae7b]">LITROS</small>
              {cierre.litros || '0'}
            </div>
            <span className="tabular absolute bottom-2 left-2 rounded-md bg-[#0d0c0a]/70 px-1.5 py-0.5 text-[11px] text-white">
              surtidor_{cerrando.equipo}.jpg · ahora
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCierre((c) => ({ ...c, foto: true }))}
            className="flex min-h-28 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[18px] border-2 border-dashed border-[#e7a3a3] bg-[#fff8f8] p-3 text-[15px] font-semibold"
          >
            <Camera className="h-7 w-7" />
            Tomar foto del surtidor
            <small className="text-[12.5px] font-normal text-muted-foreground">
              Funciona sin señal: sube al sincronizar
            </small>
          </button>
        )}
      </div>

      <Campo label="Observaciones">
        <Textarea
          rows={3}
          placeholder="Novedades del equipo durante el turno"
          value={cierre.observaciones}
          onChange={(e) => setCierre((c) => ({ ...c, observaciones: e.target.value }))}
        />
      </Campo>

      <Boton ancho onClick={confirmarCierre} disabled={!cierre.foto || finalNum == null || finalInvalido}>
        Cerrar tarjeta <ArrowRight className="h-[19px] w-[19px]" />
      </Boton>
      {!cierre.foto && (
        <p className="m-0 text-center text-[12.5px] text-muted-foreground">
          Falta la foto del surtidor para cerrar.
        </p>
      )}
    </>
  );

  return (
    <>
      <VistaHead
        titulo="Registro de equipo"
        contexto={
          <>
            <ChipContexto>Faena Patillo</ChipContexto>
            <ChipContexto>DIURNO · 08–20</ChipContexto>
            <Chip tono="warning">Maqueta</Chip>
          </>
        }
      />

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
                  bajada={`${cerrando.operador} · Turno ${cerrando.turno === 'D' ? 'DIURNO 24/09' : 'NOCTURNO 23/09'}`}
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
          bajada={`${cerrando.operador} · Turno ${cerrando.turno === 'D' ? 'DIURNO 24/09' : 'NOCTURNO 23/09'}`}
          onCerrar={() => setCerrandoId(null)}
        >
          <Form>{formularioCierre}</Form>
        </Hoja>
      )}

      {verReporte && (
        <Hoja
          eyebrow="Reporte de salida de turno"
          titulo={reporte === 'enviado' ? 'Reporte emitido' : 'Revisá y enviá'}
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
                ['Fecha', '24/09/2026'],
                ['Turno', 'DIURNO · 08–20'],
                ['Emitido', reporteA ?? '08:41'],
                ['Supervisor', SUPERVISOR],
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
              <b className="text-foreground">Destinatarios:</b> administrador y Sergio Torres. Aviso dentro del sistema
              y correo con el PDF adjunto. Nunca a los clientes finales de Optimiza.
            </span>
          </div>

          {reporte === 'sin-enviar' && (
            <Boton
              variante="acento"
              ancho
              className="min-h-[60px] !rounded-[18px] !text-[17px]"
              onClick={() => {
                setReporte('enviado');
                setReporteA(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }));
                setVerReporte(false);
              }}
            >
              Enviar ahora <ArrowRight className="h-[19px] w-[19px]" />
            </Boton>
          )}
        </Hoja>
      )}
    </>
  );
}
