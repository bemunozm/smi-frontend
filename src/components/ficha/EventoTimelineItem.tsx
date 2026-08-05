import { Card, Chip } from '@heroui/react';

import { eventoTipoColor, eventoTipoLabel, hallazgoEstadoLabel, isOneOf } from '../../config/ficha-colors';
import {
  ESTADO_ACTIVIDAD_LABELS,
  ORIGEN_ACTIVIDAD_LABELS,
  PRIORIDAD_OT_LABELS,
  TIPO_OT_LABELS,
} from '../../config/mantenimiento-colors';
import { CRITICIDADES, HALLAZGO_ESTADOS } from '../../types/dashboard';
import type { EventoFicha } from '../../types/ficha';
import { ESTADOS_ACTIVIDAD, ORIGENES_ACTIVIDAD, PRIORIDADES_OT, TIPOS_OT } from '../../types/mantenimiento';

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });
const FECHA = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatFecha(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : FECHA.format(date);
}

type MetaValue = EventoFicha['meta'][string];

function asNumber(value: MetaValue): number | null {
  return typeof value === 'number' ? value : null;
}

function asString(value: MetaValue): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

interface MetaField {
  label: string;
  value: string;
}

/**
 * Hasta 2 campos de `meta` relevantes por tipo de evento — el shape de
 * `meta` varía por dominio (ver `smi-backend/src/ficha/ficha.service.ts`,
 * los `map*` de cada origen), así que cada `case` sabe qué claves esperar
 * pero igual las angosta con guards (`meta` es un record flexible sin
 * garantía de shape en el tipo).
 */
function metaFields(evento: EventoFicha): MetaField[] {
  const { meta } = evento;
  const fields: MetaField[] = [];

  switch (evento.tipo) {
    case 'COMBUSTIBLE': {
      const litros = asNumber(meta.litros);
      const tipoCombustible = asString(meta.tipo);
      if (litros !== null) fields.push({ label: 'Litros', value: `${NUMERO.format(litros)} L` });
      if (tipoCombustible) fields.push({ label: 'Tipo', value: tipoCombustible });
      break;
    }
    case 'HOROMETRO': {
      const turno = asString(meta.turno);
      const inicial = asNumber(meta.valorInicial);
      const final = asNumber(meta.valorFinal);
      if (turno) fields.push({ label: 'Turno', value: turno });
      if (inicial !== null) {
        fields.push({
          label: 'Horómetro',
          value:
            final !== null
              ? `${NUMERO.format(inicial)} → ${NUMERO.format(final)} h`
              : `${NUMERO.format(inicial)} h`,
        });
      }
      break;
    }
    case 'TRABAJO_EXTRA': {
      const horas = asNumber(meta.totalHoras);
      const turno = asString(meta.turno);
      if (horas !== null) fields.push({ label: 'Horas', value: `${NUMERO.format(horas)} h` });
      if (turno) fields.push({ label: 'Turno', value: turno });
      break;
    }
    case 'HALLAZGO': {
      const prioridad = asString(meta.prioridad);
      const estado = asString(meta.estado);
      if (prioridad) {
        fields.push({
          label: 'Prioridad',
          value: isOneOf(CRITICIDADES, prioridad) ? PRIORIDAD_OT_LABELS[prioridad] : prioridad,
        });
      }
      if (estado) {
        fields.push({
          label: 'Estado',
          value: isOneOf(HALLAZGO_ESTADOS, estado) ? hallazgoEstadoLabel(estado) : estado,
        });
      }
      break;
    }
    case 'ORDEN_TRABAJO': {
      const tipoOt = asString(meta.tipo);
      const prioridad = asString(meta.prioridad);
      if (tipoOt) {
        fields.push({ label: 'Tipo', value: isOneOf(TIPOS_OT, tipoOt) ? TIPO_OT_LABELS[tipoOt] : tipoOt });
      }
      if (prioridad) {
        fields.push({
          label: 'Prioridad',
          value: isOneOf(PRIORIDADES_OT, prioridad) ? PRIORIDAD_OT_LABELS[prioridad] : prioridad,
        });
      }
      break;
    }
    case 'INTERVENCION': {
      const tipoOt = asString(meta.tipo);
      const horasHombre = asNumber(meta.horasHombre);
      if (tipoOt) {
        fields.push({ label: 'Tipo', value: isOneOf(TIPOS_OT, tipoOt) ? TIPO_OT_LABELS[tipoOt] : tipoOt });
      }
      if (horasHombre !== null) fields.push({ label: 'Horas hombre', value: `${NUMERO.format(horasHombre)} h` });
      break;
    }
    case 'ACTIVIDAD': {
      const origen = asString(meta.origen);
      const estado = asString(meta.estado);
      if (origen) {
        fields.push({
          label: 'Origen',
          value: isOneOf(ORIGENES_ACTIVIDAD, origen) ? ORIGEN_ACTIVIDAD_LABELS[origen] : origen,
        });
      }
      if (estado) {
        fields.push({
          label: 'Estado',
          value: isOneOf(ESTADOS_ACTIVIDAD, estado) ? ESTADO_ACTIVIDAD_LABELS[estado] : estado,
        });
      }
      break;
    }
  }

  return fields.slice(0, 2);
}

/** Un item de la línea de tiempo consolidada de la ficha del equipo — chip
 * de tipo (color por dominio, afinado por estado/prioridad cuando aplica),
 * fecha, título/detalle del evento y hasta 2 campos de `meta` relevantes. */
export function EventoTimelineItem({ evento }: { evento: EventoFicha }) {
  const fields = metaFields(evento);

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Chip color={eventoTipoColor(evento)} size="sm" variant="soft">
            {eventoTipoLabel(evento.tipo)}
          </Chip>
          <span className="text-xs text-muted-foreground">{formatFecha(evento.fecha)}</span>
        </div>
        <Card.Title className="text-sm font-semibold text-foreground">{evento.titulo}</Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col gap-2 text-sm">
        <p className="text-foreground">{evento.detalle}</p>
        {fields.length > 0 ? (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {fields.map((field) => (
              <span key={field.label}>
                {field.label}: {field.value}
              </span>
            ))}
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}
