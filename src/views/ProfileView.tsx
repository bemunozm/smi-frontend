import { FichaPerfil } from '../components/perfil/FichaPerfil';

/**
 * Página de perfil (`/perfil`) — la misma ficha de solo lectura que muestra el
 * popup «Ver perfil» de los menús de usuario (ver
 * `components/perfil/FichaPerfil.tsx`), con el encabezado de página.
 */
export function ProfileView() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
          SMI · Cuenta
        </span>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
          Mi perfil
        </h1>
        <p className="text-sm text-muted-foreground">Información de tu cuenta en el sistema.</p>
      </div>

      <FichaPerfil />
    </div>
  );
}
