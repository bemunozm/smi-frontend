import { useState } from 'react';
import { toast } from '@heroui/react';
import { ArrowRight } from 'lucide-react';

import { OperatorPicker } from '../operators/OperatorPicker';
import { Boton, Campo, Form, Hint, Input, Selector } from '../terreno/ui';
import { formatDecimalInput, parseDecimal } from '../../lib/decimal';
import { fmtLectura, nombreEquipo } from '../../lib/informe-temporal';
import { fechaDeTurno, toDateOnly, turnoDe } from '../../lib/turno';
import { generateUuid } from '../../lib/uuid';
import { enqueueOpenCard } from '../../offline/outbox';
import type { Equipment } from '../../types/equipment';

/**
 * Abrir un equipo del supervisor temporal: equipo operativo y libre (pesado o
 * camioneta), operador si es pesado y lectura inicial. Va por la cola como
 * cualquier apertura de Terreno (`enqueueOpenCard`); un rechazo del servidor
 * (`EQUIPMENT_BUSY`…) aparece en la sincronización, igual que hoy. El turno se
 * manda por contrato: para este rol el backend no lo valida ni crea un `Shift`.
 */
export function AbrirTarjetaTemporal({
  disponibles,
  hint,
  userId,
  onAbierta,
}: {
  /** Equipos operativos y libres, pesados y livianos. */
  disponibles: Equipment[];
  hint?: string;
  userId: string | undefined;
  onAbierta?: () => void;
}) {
  const [equipoId, setEquipoId] = useState('');
  const [operador, setOperador] = useState<string | null>(null);
  const [lectura, setLectura] = useState('');
  const [abriendo, setAbriendo] = useState(false);

  const equipo = disponibles.find((e) => e.id === equipoId);
  const liviano = equipo?.equipmentClass === 'LIGHT';
  const ultima = (liviano ? equipo?.currentMileage : equipo?.currentHourmeter) ?? null;
  // Vacío = la última lectura del equipo; un texto que no es número es un error.
  const texto = lectura.trim();
  const invalida = texto !== '' && parseDecimal(texto) == null;
  const valorInicial = texto === '' ? ultima : parseDecimal(texto);
  const bajoUltima = valorInicial != null && ultima != null && valorInicial < ultima;
  const faltaOperador = equipo != null && !liviano && !operador;

  const abrir = async () => {
    if (!equipo || faltaOperador || valorInicial == null || abriendo || !userId) return;
    setAbriendo(true);
    const ahora = new Date();
    try {
      await enqueueOpenCard(userId, {
        id: generateUuid(),
        equipoId: equipo.id,
        ...(liviano || !operador ? {} : { operatorId: operador }),
        valorInicial,
        shiftDate: toDateOnly(fechaDeTurno(ahora)),
        shiftType: turnoDe(ahora),
        capturedAt: ahora.toISOString(),
      });
      setEquipoId('');
      setOperador(null);
      setLectura('');
      onAbierta?.();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'No se pudo guardar la apertura en el equipo.');
    } finally {
      setAbriendo(false);
    }
  };

  if (disponibles.length === 0) {
    return <Hint>No hay equipos operativos libres para abrir.</Hint>;
  }

  return (
    <Form>
      <Campo label="Equipo" hint={hint}>
        <Selector
          etiqueta="Equipo"
          placeholder="Elige el equipo…"
          tituloTabular
          valor={equipoId}
          onChange={(id) => {
            const eq = disponibles.find((x) => x.id === id);
            const esLiviano = eq?.equipmentClass === 'LIGHT';
            setEquipoId(id);
            setLectura(formatDecimalInput(esLiviano ? eq?.currentMileage : eq?.currentHourmeter, esLiviano ? 0 : 1));
          }}
          opciones={disponibles.map((e) => ({
            valor: e.id,
            titulo: e.internalCode,
            detalle: nombreEquipo(e),
            grupo: e.equipmentClass === 'LIGHT' ? 'Camionetas' : 'Maquinaria',
          }))}
        />
      </Campo>

      {equipo && !liviano && (
        <OperatorPicker value={operador} onChange={(op) => setOperador(op?.id ?? null)} label="Operador" />
      )}

      <Campo
        label={liviano ? 'Kilometraje inicial' : 'Horómetro inicial'}
        unidad={liviano ? 'km' : 'h'}
        error={invalida ? 'Escribe un número, por ejemplo 2120,5.' : undefined}
        aviso={
          bajoUltima && ultima != null
            ? `Es menor que la última lectura registrada (${fmtLectura(ultima, liviano)}). Revisa que esté bien.`
            : undefined
        }
        hint={
          !equipo
            ? 'Elige un equipo para ver su última lectura.'
            : ultima != null
              ? `Último registrado: ${fmtLectura(ultima, liviano)}`
              : 'Sin lectura previa para este equipo.'
        }
      >
        <Input numerico value={lectura} onChange={(e) => setLectura(e.target.value)} />
      </Campo>

      <Boton ancho onClick={() => void abrir()} disabled={!equipo || faltaOperador || abriendo || valorInicial == null}>
        {abriendo ? 'Abriendo…' : 'Abrir equipo'} <ArrowRight className="size-[19px]" />
      </Boton>
      {(!equipo || faltaOperador) && (
        <p className="m-0 text-center text-[12.5px] text-muted-foreground">
          {!equipo ? 'Elige el equipo para abrirlo.' : 'Elige el operador para abrir el equipo.'}
        </p>
      )}
    </Form>
  );
}
