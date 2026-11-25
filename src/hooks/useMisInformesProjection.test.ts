import { describe, expect, it } from 'vitest';

import { proyectarInformesPendientes } from './useMisInformesProjection';
import type { HttpWriteOp, OutboxOp } from '../offline/db';
import { INFORMES_TEMPORALES_KEY, INFORMES_TEMPORALES_MINE_KEY, QUERY_KEYS } from '../lib/query-keys';
import { ENDPOINTS } from '../offline/endpoints';
import type { InformeTemporal } from '../types/informe-temporal';

function envio(id: string, body: Partial<HttpWriteOp['body']> = {}, over: Partial<HttpWriteOp> = {}): HttpWriteOp {
  return {
    id: `op-${id}`,
    type: 'httpWrite',
    v: 1,
    userId: 'u1',
    status: 'pending',
    attempts: 0,
    createdAt: 1,
    seq: 1,
    updatedAt: 1,
    endpoint: 'informeTemporal.create',
    params: {},
    body: {
      id,
      fecha: '2026-11-24',
      turno: 'NOCTURNO',
      actividad1: ' Limpieza de cancha ',
      actividad2: 'Riego',
      cierres: [{ cardId: 'c1' }, { cardId: 'c2' }],
      ...body,
    },
    label: 'Informe supervisor temporal',
    ...over,
  };
}

const delServidor = (id: string) => ({ id }) as InformeTemporal;

describe('proyectarInformesPendientes', () => {
  it('arma el informe pendiente desde el cuerpo del envío en cola', () => {
    expect(proyectarInformesPendientes([], [envio('i1')])).toEqual([
      {
        id: 'i1',
        fecha: '2026-11-24',
        turno: 'NOCTURNO',
        actividad1: 'Limpieza de cancha',
        actividad2: 'Riego',
        equipos: 2,
        requiereAtencion: false,
      },
    ]);
  });

  it('el que ya devuelve el servidor no se repite', () => {
    expect(proyectarInformesPendientes([delServidor('i1')], [envio('i1')])).toEqual([]);
  });

  it('marca el que espera una acción en la sincronización y ordena del más nuevo al más viejo', () => {
    const lista = proyectarInformesPendientes(
      [],
      [envio('viejo', { fecha: '2026-11-20' }), envio('nuevo', { fecha: '2026-11-25' }, { status: 'needs_attention' })],
    );
    expect(lista.map((p) => p.id)).toEqual(['nuevo', 'viejo']);
    expect(lista[0]?.requiereAtencion).toBe(true);
  });

  it('en la misma fecha va primero el último encolado', () => {
    const lista = proyectarInformesPendientes(
      [],
      [envio('primero', {}, { seq: 10 }), envio('segundo', {}, { seq: 11 }), envio('ayer', { fecha: '2026-11-23' })],
    );
    expect(lista.map((p) => p.id)).toEqual(['segundo', 'primero', 'ayer']);
  });

  it('ignora otras operaciones y cuerpos sin id o sin fecha', () => {
    const otra = { ...envio('x'), endpoint: 'informeTemporal.update' } as HttpWriteOp;
    const ops: OutboxOp[] = [otra, envio('sin-fecha', { fecha: undefined }), envio('', {})];
    expect(proyectarInformesPendientes([], ops)).toEqual([]);
  });
});

describe('El historial de reportes se refresca al enviar un informe', () => {
  it('su key cuelga de la que invalida `informeTemporal.create`', () => {
    expect(ENDPOINTS['informeTemporal.create'].invalidate).toContain('informesTemporales');
    expect(QUERY_KEYS.informesTemporales).toEqual(INFORMES_TEMPORALES_KEY);
    expect(INFORMES_TEMPORALES_MINE_KEY.slice(0, INFORMES_TEMPORALES_KEY.length)).toEqual([...INFORMES_TEMPORALES_KEY]);
  });
});
