import { useEffect, useRef, useState } from 'react';

import { useSession } from '../lib/auth-client';
import { markSessionEnded } from '../lib/cache-owner';
import { clearSessionSnapshot, readSessionSnapshot, saveSessionSnapshot } from '../lib/session-snapshot';
import { isRole, type Role } from '../types/roles';

type SessionData = ReturnType<typeof useSession>['data'];

/** Usuario tal como lo devuelve Better Auth (incluye `role` sin angostar). */
export type CurrentSessionUser = NonNullable<SessionData>['user'];

export interface CurrentUser {
  user: CurrentSessionUser | null;
  /** `role` angostado al union `Role` (null si falta o es un valor desconocido). */
  role: Role | null;
  isPending: boolean;
  isAuthenticated: boolean;
  /**
   * `true` cuando lo que se está mostrando viene del snapshot local
   * (`lib/session-snapshot.ts`) y no de una respuesta confirmada por el
   * servidor — arranque en frío sin señal, o `get-session` que no contesta.
   * El backend sigue exigiendo la cookie real para cualquier petición: esto
   * solo describe qué está pintando la UI, nunca autoriza nada.
   */
  isOfflineSnapshot: boolean;
}

/** Cuánto se espera a que `get-session` conteste antes de recurrir al
 * snapshot local: solo ante error de red o un `get-session` de más de 4 s. */
const PENDING_FALLBACK_MS = 4000;

/** `error.status` solo existe (como `number`) cuando Better Auth alcanzó a
 * hablar con el servidor y este contestó con un código HTTP real (ver
 * `session-atom.mjs` de `better-auth`: un fetch que nunca llega a responder
 * — sin red — cae al `catch` y guarda el `TypeError` crudo del `fetch()`,
 * que NUNCA tiene `.status`). Por eso "sin status HTTP" es exactamente
 * "objeto sin `status: number`", sin necesitar mirar el mensaje. */
function hasHttpStatus(error: unknown): error is { status: number } {
  return typeof error === 'object' && error !== null && typeof (error as { status?: unknown }).status === 'number';
}

/**
 * Reconstruye un `CurrentSessionUser` a partir del snapshot local. El `user`
 * real de Better Auth trae más campos (`image`, `emailVerified`, `banned`,
 * fechas) que el snapshot no guarda — se completan con valores neutros. Se
 * arma con este shape completo (en vez de agregar un tipo `user` nuevo/unión)
 * a propósito: así Topbar/ProfileView/TerrenoLayout/etc. siguen consumiendo
 * `useCurrentUser().user` exactamente igual, online u offline, sin tener que
 * tocarlas.
 */
function toOfflineUser(snapshot: NonNullable<ReturnType<typeof readSessionSnapshot>>): CurrentSessionUser {
  const savedAt = new Date(snapshot.savedAt);
  return {
    id: snapshot.userId,
    name: snapshot.name,
    email: snapshot.email,
    emailVerified: true,
    image: null,
    role: snapshot.role ?? undefined,
    banned: null,
    createdAt: savedAt,
    updatedAt: savedAt,
  };
}

/**
 * Wrapper cómodo sobre `useSession()`. `useSession()` (Better Auth) sigue
 * siendo la ÚNICA fuente de verdad de la sesión CONFIRMADA — este hook no
 * agrega estado propio de autorización, solo empaqueta la forma en la que
 * los componentes la consumen (usuario tipado, rol angostado) y agrega un
 * fallback de solo-lectura para el arranque en frío sin señal (ver
 * `lib/session-snapshot.ts`): si `get-session` falla por red o tarda más de
 * `PENDING_FALLBACK_MS`, y hay un snapshot de una sesión anterior, la UI
 * puede seguir renderizando en vez de rebotar a `/login` (bug que hacía
 * inutilizable Terreno sin señal).
 */
export function useCurrentUser(): CurrentUser {
  const { data: session, isPending, error } = useSession();
  const rawRole = session?.user.role;

  const [pendingTooLong, setPendingTooLong] = useState(false);
  const pendingStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPending) {
      pendingStartRef.current = null;
      setPendingTooLong(false);
      return;
    }
    if (pendingStartRef.current == null) {
      pendingStartRef.current = Date.now();
    }
    const elapsed = Date.now() - pendingStartRef.current;
    if (elapsed >= PENDING_FALLBACK_MS) {
      setPendingTooLong(true);
      return;
    }
    const timer = window.setTimeout(() => setPendingTooLong(true), PENDING_FALLBACK_MS - elapsed);
    return () => window.clearTimeout(timer);
  }, [isPending]);

  // Persiste el snapshot ante TODA sesión confirmada por el servidor — la
  // única escritura de este archivo (ver `lib/session-snapshot.ts`).
  useEffect(() => {
    if (!session?.user) return;
    saveSessionSnapshot({
      userId: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: isRole(session.user.role) ? session.user.role : null,
      savedAt: Date.now(),
    });
  }, [session]);

  // Un 401 real (el servidor SÍ contestó, y dice "esta sesión ya no vale")
  // invalida también el fallback offline — distinto de un error de red, que
  // no dice nada sobre si la sesión sigue siendo válida.
  useEffect(() => {
    if (hasHttpStatus(error) && error.status === 401) {
      clearSessionSnapshot();
      // Las cachés que quedaron eran de esa sesión: el próximo inicio las purga.
      markSessionEnded();
    }
  }, [error]);

  if (session?.user) {
    return {
      user: session.user,
      role: isRole(rawRole) ? rawRole : null,
      isPending: false,
      isAuthenticated: true,
      isOfflineSnapshot: false,
    };
  }

  const isNetworkError = error != null && !hasHttpStatus(error);
  if (isNetworkError || pendingTooLong) {
    const snapshot = readSessionSnapshot();
    if (snapshot) {
      return {
        user: toOfflineUser(snapshot),
        role: snapshot.role,
        isPending: false,
        isAuthenticated: true,
        isOfflineSnapshot: true,
      };
    }
  }

  return {
    user: null,
    role: null,
    isPending,
    isAuthenticated: false,
    isOfflineSnapshot: false,
  };
}
