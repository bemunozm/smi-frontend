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
 *
 * Instalar también se recuerda por dispositivo: si Chrome no logra crear la
 * app de verdad (queda un acceso directo con el ícono de Chrome encima), sigue
 * avisando que es instalable y el aviso volvería en cada visita desde el
 * navegador. Con la marca no se invita solo; el menú «Instalar app» queda.
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
  /** Ya se instaló alguna vez en este dispositivo (persistido). */
  yaInstalada: boolean;
  /** Reabierta desde el menú de usuario: se muestra aunque se haya descartado. */
  reabierta: boolean;
}

const DISMISSED_KEY = 'smi.pwa-install-dismissed';
const INSTALLED_KEY = 'smi.pwa-installed';

function leerMarca(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function guardarMarca(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Sin storage el aviso vuelve a aparecer: molesto pero inocuo.
  }
}

function estadoInicial(): Estado {
  return {
    evento: null,
    instalada: false,
    descartado: leerMarca(DISMISSED_KEY),
    yaInstalada: leerMarca(INSTALLED_KEY),
    reabierta: false,
  };
}

let estado: Estado = estadoInicial();
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
  // Abierta como app: está instalada en este equipo (la pestaña de Chrome
  // comparte el localStorage y deja de invitar).
  if (isStandalonePwa()) {
    guardarMarca(INSTALLED_KEY);
    actualizar({ yaInstalada: true });
  }
  window.addEventListener('beforeinstallprompt', (event) => {
    // Sin esto Chrome muestra su propia mini-barra además de la nuestra.
    event.preventDefault();
    actualizar({ evento: event as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => {
    guardarMarca(INSTALLED_KEY);
    actualizar({ evento: null, instalada: true, yaInstalada: true, reabierta: false });
  });
}

function modoActual(e: Estado): ModoInstalar | null {
  if (e.instalada || isStandalonePwa()) return null;
  if (e.evento) return 'nativo';
  return esIos() ? 'ios' : null;
}

/** Solo tests: vuelve al estado inicial (el estado vive a nivel de módulo). */
export function reiniciarInvitacionInstalar(): void {
  estado = estadoInicial();
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
    if (outcome === 'accepted') {
      guardarMarca(INSTALLED_KEY);
      actualizar({ instalada: true, yaInstalada: true, reabierta: false });
    }
  };

  const descartar = (): void => {
    guardarMarca(DISMISSED_KEY);
    actualizar({ descartado: true, reabierta: false });
  };

  return {
    /** null: ya instalada o el navegador no ofrece instalar. */
    modo,
    /** Si corresponde mostrar el aviso ahora. */
    invitar: modo !== null && ((!actual.descartado && !actual.yaInstalada) || actual.reabierta),
    instalar,
    descartar,
    reabrir: () => actualizar({ reabierta: true }),
  };
}
