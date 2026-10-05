import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { syncStatusPresentation } from './sync-status-presentation';
import type { SyncState } from './replay';

afterEach(cleanup);

const BASE: SyncState = {
  pendingCount: 0,
  attentionCount: 0,
  otherAccountCount: 0,
  syncing: false,
  authRequired: false,
  lastSyncAt: null,
  lastError: null,
  notice: null,
};

/** El texto puede ser un fragmento JSX (`<b>…</b>` + literal) — se renderiza
 * para poder aserir sobre el texto visible en vez de comparar nodos React. */
function textoVisible(texto: React.ReactNode): string {
  const { container } = render(<>{texto}</>);
  return container.textContent ?? '';
}

describe('syncStatusPresentation — prioridad de estados', () => {
  it('authRequired tiene la MÁXIMA prioridad, aun con pendientes', () => {
    const { tono, texto } = syncStatusPresentation({ ...BASE, authRequired: true, pendingCount: 3 }, false, true);
    expect(tono).toBe('danger');
    expect(textoVisible(texto)).toContain('Tu sesión expiró.');
  });

  it('isOfflineSnapshot va segundo: "Sin señal · sesión guardada"', () => {
    const { tono, texto } = syncStatusPresentation(BASE, true, true);
    expect(tono).toBe('warning');
    expect(textoVisible(texto)).toContain('Sin señal');
    expect(textoVisible(texto)).toContain('sesión guardada');
  });

  it('"Sin señal · sesión guardada" sigue contando lo que espera en la cola', () => {
    const { tono, texto } = syncStatusPresentation({ ...BASE, pendingCount: 3 }, true, false);
    expect(tono).toBe('warning');
    expect(textoVisible(texto)).toBe('Sin señal · sesión guardada. 3 registros por sincronizar.');
  });

  it('"Sin señal · sesión guardada" no esconde lo que requiere atención', () => {
    const { tono, texto } = syncStatusPresentation({ ...BASE, pendingCount: 1, attentionCount: 2 }, true, false);
    expect(tono).toBe('danger');
    expect(textoVisible(texto)).toBe(
      'Sin señal · sesión guardada. 1 registro por sincronizar. 2 registros requieren atención.',
    );
  });

  it('attentionCount > 0: singular ("1 registro requiere atención")', () => {
    const { tono, texto } = syncStatusPresentation({ ...BASE, attentionCount: 1 }, false, true);
    expect(tono).toBe('danger');
    expect(textoVisible(texto)).toBe('1 registro requiere atención.');
  });

  it('attentionCount > 1: plural ("2 registros requieren atención")', () => {
    const { texto } = syncStatusPresentation({ ...BASE, attentionCount: 2 }, false, true);
    expect(textoVisible(texto)).toBe('2 registros requieren atención.');
  });

  it('syncing: "Sincronizando…"', () => {
    const { tono, texto } = syncStatusPresentation({ ...BASE, syncing: true }, false, true);
    expect(tono).toBe('neutral');
    expect(texto).toBe('Sincronizando…');
  });

  it('pendingCount > 0: "N registros por sincronizar"', () => {
    const { tono, texto } = syncStatusPresentation({ ...BASE, pendingCount: 2 }, false, true);
    expect(tono).toBe('warning');
    expect(textoVisible(texto)).toBe('2 registros por sincronizar.');
  });

  it('sin señal y nada pendiente: la promesa neutra de siempre', () => {
    const { tono, texto } = syncStatusPresentation(BASE, false, false);
    expect(tono).toBe('warning');
    expect(texto).toBe('Sin señal. Lo que registres queda guardado en el equipo y se envía solo al volver la conexión.');
  });

  it('en línea, sin pendientes, ya sincronizó: "Todo sincronizado · HH:MM"', () => {
    const lastSyncAt = new Date(2026, 8, 24, 8, 41).getTime();
    const { tono, texto } = syncStatusPresentation({ ...BASE, lastSyncAt }, false, true);
    expect(tono).toBe('success');
    // `toContain` (no `toBe`): el formato exacto de `toLocaleTimeString`
    // depende de los datos ICU del entorno (algunos agregan "a. m."/"p. m."
    // aunque se pida `hour: '2-digit'`) — lo que importa es que la hora
    // aparezca, no el sufijo.
    expect(textoVisible(texto)).toContain('Todo sincronizado · 08:41');
  });

  it('estado inicial (nunca sincronizó, nada pendiente, en línea): mensaje neutro', () => {
    const { tono, texto } = syncStatusPresentation(BASE, false, true);
    expect(tono).toBe('neutral');
    expect(texto).toBe('Preparado para registrar sin señal.');
  });
});

describe('syncStatusPresentation — pantalla completa de screen (integración liviana)', () => {
  it('el texto derivado se puede montar sin romper (smoke)', () => {
    const { texto } = syncStatusPresentation({ ...BASE, attentionCount: 1 }, false, true);
    render(<>{texto}</>);
    expect(screen.getByText(/requiere atención/)).toBeTruthy();
  });
});
