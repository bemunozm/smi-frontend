import { useSyncExternalStore } from 'react';

import { isStandalonePwa } from './standalone';

/**
 * Invitación a instalar la PWA. Chrome/Edge (Android y escritorio) avisan con
 * `beforeinstallprompt` que la app es instalable: se guarda el evento y el
 * botón «Instalar» nuestro es el gesto que abre el diálogo real del sistema
 * (el navegador no deja abrirlo solo). iOS no tiene esa API: allá solo queda
 * explicar los pasos (Compartir → «Agregar a pantalla de inicio»).
 *
 * El evento llega temprano, a veces antes de que React monte, así que
 * `capturarInvitacionInstalar()` se llama en `main.tsx` y el estado vive a
 * nivel de módulo; los componentes lo leen con `useInstalarApp()`.
 *
 * El «Ahora no» es por DISPOSITIVO (no por usuario, a diferencia del push):
 * instalar es del equipo, no de la sesión — la tablet compartida no debe
 * preguntarle a cada turno.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** `nativo`: hay diálogo del sistema. `ios`: solo instrucciones. */
export type ModoInstalar = 'nativo' | 'ios';

interface Estado {
  evento: BeforeInstallPromptEvent | null;
  instalada: boolean;
  descartado: boolean;
  /** Reabierta desde el menú de usuario: se muestra aunque se haya descartado. */
  reabierta: boolean;
}

const DISMISSED_KEY = 'smi.pwa-install-dismissed';

function leerDescartado(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

let estado: Estado = { evento: null, instalada: false, descartado: leerDescartado(), reabierta: false };
const oyentes = new Set<() => void>();

function actualizar(cambio: Partial<Estado>): void {
  estado = { ...estado, ...cambio };
  oyentes.forEach((oyente) => oyente());
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/** iPhone/iPad. El iPad con iPadOS se presenta como Mac: lo delata el táctil. */
function esIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

let capturando = false;

/** Llamar UNA vez al arrancar (`main.tsx`), antes de que el navegador avise. */
export function capturarInvitacionInstalar(): void {
  if (capturando || typeof window === 'undefined') return;
  capturando = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    // Sin esto Chrome muestra su propia mini-barra además de la nuestra.
    event.preventDefault();
    actualizar({ evento: event as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => {
    actualizar({ evento: null, instalada: true, reabierta: false });
  });
}

function modoActual(e: Estado): ModoInstalar | null {
  if (e.instalada || isStandalonePwa()) return null;
  if (e.evento) return 'nativo';
  return esIos() ? 'ios' : null;
}

/** Solo tests: vuelve al estado inicial (el estado vive a nivel de módulo). */
export function reiniciarInvitacionInstalar(): void {
  estado = { evento: null, instalada: false, descartado: leerDescartado(), reabierta: false };
  oyentes.forEach((oyente) => oyente());
}

export function useInstalarApp() {
  const actual = useSyncExternalStore(suscribir, () => estado);
  const modo = modoActual(actual);

  /** Abre el diálogo del sistema; el evento sirve una sola vez. */
  const instalar = async (): Promise<void> => {
    const evento = actual.evento;
    if (!evento) return;
    actualizar({ evento: null });
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === 'accepted') actualizar({ instalada: true, reabierta: false });
  };

  const descartar = (): void => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Sin storage el aviso vuelve a aparecer: molesto pero inocuo.
    }
    actualizar({ descartado: true, reabierta: false });
  };

  return {
    /** null: ya instalada o el navegador no ofrece instalar. */
    modo,
    /** Si corresponde mostrar el aviso ahora. */
    invitar: modo !== null && (!actual.descartado || actual.reabierta),
    instalar,
    descartar,
    reabrir: () => actualizar({ reabierta: true }),
  };
}
