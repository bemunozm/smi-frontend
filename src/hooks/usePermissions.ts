import { canCloseShiftCardFromFleet, canWrite, canWriteAny } from '../lib/permissions';
import type { EndpointKey } from '../offline/endpoints';
import type { Role } from '../types/roles';
import { useCurrentUser } from './useCurrentUser';

export interface Permissions {
  role: Role | null;
  /** Puede hacer esta escritura (los `@Roles` del backend, `lib/permissions.ts`). */
  can: (action: EndpointKey) => boolean;
  /** Puede hacer al menos una de estas escrituras. */
  canAny: (actions: readonly EndpointKey[]) => boolean;
  canCloseShiftCardFromFleet: boolean;
}

/** Qué escrituras ofrece la pantalla al rol de la sesión. */
export function usePermissions(): Permissions {
  const { role } = useCurrentUser();
  return {
    role,
    can: (action) => canWrite(role, action),
    canAny: (actions) => canWriteAny(role, actions),
    canCloseShiftCardFromFleet: canCloseShiftCardFromFleet(role),
  };
}
