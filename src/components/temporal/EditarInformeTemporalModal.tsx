import { useState } from 'react';
import { Button, Modal, Spinner } from '@heroui/react';

import { PersonalActividad, type LineaPersonal } from './PersonalActividad';
import { RESPONSIVE_SHEET_DIALOG_WIDE_CLASS } from '../flota/modal-styles';
import { DateField } from '../terreno/DateField';
import { Campo, Input, Label, Segmentado, Textarea } from '../terreno/ui';
import { useActualizarInformeTemporal } from '../../hooks/useInformesTemporales';
import type { InformeTemporal, PersonalInforme, UpdateInformeTemporalInput } from '../../types/informe-temporal';
import {
  MAX_ACTIVIDAD_INFORME,
  MAX_OBSERVACIONES_INFORME,
  MAX_PERSONAL_POR_ACTIVIDAD,
  nuevaLinea,
} from '../../lib/informe-temporal';
import { toDateOnly, type Turno } from '../../lib/turno';

const SI_NO = [
  { valor: 'no' as const, label: 'No' },
  { valor: 'si' as const, label: 'Sí' },
];

const lineasDe = (informe: InformeTemporal, actividad: 1 | 2): LineaPersonal[] =>
  informe.personal
    .filter((p) => p.actividad === actividad)
    .map((p) => nuevaLinea({ modo: p.operatorId ? 'catalogo' : 'texto', operatorId: p.operatorId, nombre: p.nombre }));

const personalDe = (l1: LineaPersonal[], l2: LineaPersonal[]): PersonalInforme[] => [
  ...l1
    .filter((l) => l.nombre.trim() !== '')
    .map((l) => ({ actividad: 1 as const, operatorId: l.operatorId, nombre: l.nombre.trim() })),
  ...l2
    .filter((l) => l.nombre.trim() !== '')
    .map((l) => ({ actividad: 2 as const, operatorId: l.operatorId, nombre: l.nombre.trim() })),
];

const clave = (p: PersonalInforme[]) => JSON.stringify(p.map((x) => [x.actividad, x.operatorId ?? null, x.nombre]));

function PreguntaSiNo({
  pregunta,
  valor,
  onChange,
}: {
  pregunta: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{pregunta}</Label>
      <Segmentado
        etiqueta={pregunta}
        valor={valor ? 'si' : 'no'}
        onChange={(v) => onChange(v === 'si')}
        opciones={SI_NO}
      />
    </div>
  );
}

/**
 * Corrige los DATOS del informe (fecha, turno, actividades, personal,
 * supervisores, observaciones y las dos declaraciones). Las lecturas de cada
 * tarjeta no se editan acá: tienen su propio «Corregir» en el detalle del
 * informe (`CorregirTarjetaTemporalModal`). Solo se envía lo que
 * cambió; `actividad2`, `observaciones` y `supervisorResponsable2` en `''` los
 * quitan.
 */
export function EditarInformeTemporalModal({ informe, onClose }: { informe: InformeTemporal; onClose: () => void }) {
  const actualizar = useActualizarInformeTemporal();
  const [fecha, setFecha] = useState(informe.fecha);
  const [turno, setTurno] = useState<Turno>(informe.turno);
  const [actividad1, setActividad1] = useState(informe.actividad1);
  const [actividad2, setActividad2] = useState(informe.actividad2 ?? '');
  const [personal1, setPersonal1] = useState<LineaPersonal[]>(() => lineasDe(informe, 1));
  const [personal2, setPersonal2] = useState<LineaPersonal[]>(() => lineasDe(informe, 2));
  const [observaciones, setObservaciones] = useState(informe.observaciones ?? '');
  const [supervisor1, setSupervisor1] = useState(informe.supervisorResponsable1);
  const [supervisor2, setSupervisor2] = useState(informe.supervisorResponsable2 ?? '');
  const [fotosEnviadas, setFotosEnviadas] = useState(informe.fotosEnviadas);
  const [infoSubidaApp, setInfoSubidaApp] = useState(informe.infoSubidaApp);
  const [intentado, setIntentado] = useState(false);

  const errores: Record<string, string> = {};
  if (fecha.trim() === '') errores.fecha = 'Elige la fecha.';
  if (actividad1.trim() === '') errores.actividad1 = 'Escribe la actividad realizada.';
  if (supervisor1.trim() === '') errores.supervisor1 = 'Escribe el supervisor responsable.';
  const nuevoPersonal = personalDe(personal1, personal2);
  if (nuevoPersonal.some((p) => p.actividad === 2) && actividad2.trim() === '') {
    errores.personal2 = 'Hay personal en la actividad 2: escribe la actividad 2 o quítalo.';
  }
  const visibles = intentado ? errores : {};

  const cambios: UpdateInformeTemporalInput = {};
  if (fecha !== informe.fecha) cambios.fecha = fecha;
  if (turno !== informe.turno) cambios.turno = turno;
  if (actividad1.trim() !== informe.actividad1) cambios.actividad1 = actividad1.trim();
  if (actividad2.trim() !== (informe.actividad2 ?? '')) cambios.actividad2 = actividad2.trim();
  const personalOriginal = personalDe(lineasDe(informe, 1), lineasDe(informe, 2));
  if (clave(nuevoPersonal) !== clave(personalOriginal)) cambios.personal = nuevoPersonal;
  if (observaciones.trim() !== (informe.observaciones ?? '')) cambios.observaciones = observaciones.trim();
  if (supervisor1.trim() !== informe.supervisorResponsable1) cambios.supervisorResponsable1 = supervisor1.trim();
  if (supervisor2.trim() !== (informe.supervisorResponsable2 ?? ''))
    cambios.supervisorResponsable2 = supervisor2.trim();
  if (fotosEnviadas !== informe.fotosEnviadas) cambios.fotosEnviadas = fotosEnviadas;
  if (infoSubidaApp !== informe.infoSubidaApp) cambios.infoSubidaApp = infoSubidaApp;

  const guardar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    actualizar.mutate({ id: informe.id, cambios }, { onSuccess: onClose });
  };

  return (
    <Modal.Backdrop
      isDismissable
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={`${RESPONSIVE_SHEET_DIALOG_WIDE_CLASS} sm:w-full`}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              Corregir informe N° {informe.numero}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4">
              <DateField label="Fecha" value={fecha} max={toDateOnly(new Date())} onChange={setFecha} />
              {visibles.fecha && (
                <span role="alert" className="text-sm text-danger">
                  {visibles.fecha}
                </span>
              )}
              <div className="flex flex-col gap-1.5">
                <Label>Turno</Label>
                <Segmentado<Turno>
                  etiqueta="Turno"
                  valor={turno}
                  onChange={setTurno}
                  opciones={[
                    { valor: 'DIURNO', label: 'Día' },
                    { valor: 'NOCTURNO', label: 'Noche' },
                  ]}
                />
              </div>
              <Campo label="Actividad realizada 1" requerido error={visibles.actividad1}>
                <Input
                  value={actividad1}
                  maxLength={MAX_ACTIVIDAD_INFORME}
                  onChange={(e) => setActividad1(e.target.value)}
                />
              </Campo>
              <PersonalActividad actividad={1} lineas={personal1} onChange={setPersonal1} />
              <Campo label="Actividad realizada 2">
                <Input
                  value={actividad2}
                  maxLength={MAX_ACTIVIDAD_INFORME}
                  onChange={(e) => setActividad2(e.target.value)}
                />
              </Campo>
              <PersonalActividad actividad={2} lineas={personal2} onChange={setPersonal2} error={visibles.personal2} />
              <Campo label="Observaciones">
                <Textarea
                  value={observaciones}
                  maxLength={MAX_OBSERVACIONES_INFORME}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </Campo>
              <Campo label="Supervisor responsable 1" requerido error={visibles.supervisor1}>
                <Input value={supervisor1} maxLength={120} onChange={(e) => setSupervisor1(e.target.value)} />
              </Campo>
              <Campo label="Supervisor responsable 2">
                <Input value={supervisor2} maxLength={120} onChange={(e) => setSupervisor2(e.target.value)} />
              </Campo>
              <PreguntaSiNo pregunta="¿Se enviaron las fotos?" valor={fotosEnviadas} onChange={setFotosEnviadas} />
              <PreguntaSiNo
                pregunta="¿Se subió la información a la app?"
                valor={infoSubidaApp}
                onChange={setInfoSubidaApp}
              />
              <p className="text-xs text-muted-foreground">
                Hasta {MAX_PERSONAL_POR_ACTIVIDAD} personas por actividad. Las lecturas y litros de cada equipo se
                corrigen con «Corregir» en su tarjeta, en el detalle del informe.
              </p>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onClose} variant="tertiary">
              Cancelar
            </Button>
            <Button isPending={actualizar.isPending} onPress={guardar}>
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Guardar corrección')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
