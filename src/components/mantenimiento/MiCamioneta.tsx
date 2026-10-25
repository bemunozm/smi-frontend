import { useMemo, useState } from 'react';
import { ArrowRight, Clock, Lock, Truck } from 'lucide-react';

import { FotoRespaldoField } from '../flota/FotoRespaldoField';
import {
  Boton,
  Calculado,
  Campo,
  Form,
  Hint,
  Input,
  Label,
  ModalTerreno,
  Selector,
  Tarjeta,
  Textarea,
} from '../terreno/ui';
import { useAperturaForm } from '../../hooks/useAperturaForm';
import { useCierreForm } from '../../hooks/useCierreForm';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useEquipment } from '../../hooks/useEquipment';
import { useShiftCardsMine } from '../../hooks/useShiftCards';
import { useShiftProjection } from '../../hooks/useShiftProjection';
import { formatDecimalInput } from '../../lib/decimal';
import { contextoTurno } from '../../lib/turno';
import { useOutboxOps } from '../../offline/useOutboxOps';

const fmtKm = (n: number | undefined) =>
  n == null ? '—' : `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })} km`;

/**
 * «Mi camioneta» del mantenedor: registra el kilometraje inicial al tomar una
 * camioneta para moverse en faena, y la cierra recién al cargar combustible
 * (km final, litros y foto del surtidor). Es la misma tarjeta de liviano del
 * supervisor (`/shift-cards`), así que también la ve —y la puede cerrar— un
 * supervisor. Va por la cola sin conexión, igual que en Terreno.
 */
export function MiCamioneta() {
  const { user } = useCurrentUser();
  const userId = user?.id;
  const nombre = user?.name?.trim() || user?.email || 'Mantenedor';
  // El turno solo agrupa la tarjeta; el mantenedor no manda reporte de salida.
  const ctx = useMemo(() => contextoTurno(new Date()), []);

  const { data: equipos = [] } = useEquipment();
  const { data: tarjetasServidor = [] } = useShiftCardsMine();
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

  const apertura = useAperturaForm({ disponibles: proyeccion.disponiblesLivianos, ctx, userId, liviano: true });
  const cierre = useCierreForm({ tarjetas: proyeccion.tarjetas, ctx, userId });
  const [abriendo, setAbriendo] = useState(false);
  const camioneta = apertura.equipoElegido;

  return (
    <>
      <Tarjeta>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft,#e8eefc)] text-[var(--accent)]">
              <Truck className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col">
              <span className="text-[16px] font-bold text-foreground">Mi camioneta</span>
              {mia ? (
                <span className="text-[14px] text-[var(--label-color)]">
                  <b className="tabular text-foreground">{mia.equipo}</b> · en uso desde {mia.abiertaEl} · km inicial{' '}
                  <b className="tabular text-foreground">{fmtKm(mia.inicial)}</b>
                </span>
              ) : (
                <span className="text-[14px] text-[var(--label-color)]">
                  Si te mueves en una camioneta, anota el kilometraje al tomarla. Se cierra al cargar combustible.
                </span>
              )}
              {mia?.sinSincronizar && (
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--warning-soft-foreground)]">
                  <Clock className="size-3.5" aria-hidden /> Guardada en el equipo · falta sincronizar
                </span>
              )}
            </div>
          </div>
          {mia ? (
            <Boton className="w-full sm:w-auto" onClick={() => cierre.abrirCierre(mia.id)}>
              Cargar combustible y cerrar <ArrowRight className="size-[18px]" />
            </Boton>
          ) : (
            <Boton className="w-full sm:w-auto" variante="contorno" onClick={() => setAbriendo(true)}>
              Usar camioneta <ArrowRight className="size-[18px]" />
            </Boton>
          )}
        </div>
      </Tarjeta>

      <ModalTerreno
        abierto={abriendo}
        onAbiertoChange={setAbriendo}
        titulo="Usar camioneta"
        detalle="Queda abierta hasta que cargues combustible."
      >
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
            <Boton
              ancho
              disabled={apertura.isAbriendo || apertura.valorInicialApertura == null}
              onClick={() => {
                apertura.abrir();
                setAbriendo(false);
              }}
            >
              Empezar a usarla <ArrowRight className="size-[19px]" />
            </Boton>
          </Form>
        )}
      </ModalTerreno>

      <ModalTerreno
        abierto={cierre.cerrando != null}
        onAbiertoChange={(abierto) => !abierto && cierre.setCerrandoId(null)}
        titulo={cierre.cerrando ? `Cerrar ${cierre.cerrando.equipo}` : 'Cerrar camioneta'}
        detalle="Al cargar combustible: kilometraje final, litros y la foto del surtidor."
      >
        {cierre.cerrando && (
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
            <Campo label="Combustible cargado" requerido unidad="L">
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
                cierre.finalInvalido
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
        )}
      </ModalTerreno>
    </>
  );
}
