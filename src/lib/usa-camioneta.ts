/**
 * ¿Este usuario usa camioneta? Lo lee del campo `usesLightVehicle`, que el
 * backend declara en `user.additionalFields` de Better Auth y por eso llega en
 * `session.user` (el cliente no lo tipa: se lee con un guard).
 *
 * Solo distingue entre administradores: supervisores, mantenedores y
 * prevencionistas usan camioneta por su rol, marquen o no la casilla. Ver
 * docs/rfc/RFC-camioneta-administradores.md (backend).
 */
export function usaCamioneta(user: unknown): boolean {
  return (
    typeof user === 'object' &&
    user !== null &&
    'usesLightVehicle' in user &&
    (user as { usesLightVehicle: unknown }).usesLightVehicle === true
  );
}
