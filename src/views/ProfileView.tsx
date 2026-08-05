import { Avatar, Card, Chip } from '@heroui/react';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { isRole } from '../types/roles';
import { roleChipColor } from '../config/role-colors';

function initialsFrom(name: string | undefined, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function formatDate(value: unknown): string {
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeStyle: 'short' }).format(date);
}

interface ProfileFieldProps {
  label: string;
  value: string;
}

function ProfileField({ label, value }: ProfileFieldProps) {
  return (
    <div className="flex flex-col gap-1 border-t border-border py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-baseline sm:justify-between sm:py-3.5">
      <span className="text-[11px] font-semibold tracking-wider text-(--label-color) uppercase">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

/**
 * Vista de perfil — solo lectura por ahora (sin edición, según el alcance
 * actual). `useCurrentUser()` es la única fuente de verdad, igual que en el
 * resto de la app: no hay fetch propio, no hay estado duplicado.
 */
export function ProfileView() {
  const { user } = useCurrentUser();

  if (!user) return null;

  const role = isRole(user.role) ? user.role : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
          SMI · Cuenta
        </span>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
          Mi perfil
        </h1>
        <p className="text-sm text-muted">Información de tu cuenta en el sistema.</p>
      </div>

      <Card className="max-w-2xl">
        <Card.Header className="flex-row items-center gap-4">
          <Avatar size="lg">
            {user.image ? <Avatar.Image alt={user.name} src={user.image} /> : null}
            <Avatar.Fallback>{initialsFrom(user.name, user.email)}</Avatar.Fallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <Card.Title className="font-display text-xl font-semibold tracking-[-0.01em]">
              {user.name || user.email}
            </Card.Title>
            <Card.Description>{user.email}</Card.Description>
          </div>
          {role ? (
            <Chip className="ms-auto" color={roleChipColor(role)} variant="soft">
              {role}
            </Chip>
          ) : null}
        </Card.Header>

        <Card.Content className="mt-2">
          <ProfileField label="Nombre" value={user.name || '—'} />
          <ProfileField label="Email" value={user.email} />
          <ProfileField label="Rol" value={role ?? '—'} />
          <ProfileField
            label="Email verificado"
            value={user.emailVerified ? 'Verificado' : 'Sin verificar'}
          />
          <ProfileField label="Miembro desde" value={formatDate(user.createdAt)} />
          <ProfileField label="Última actualización" value={formatDate(user.updatedAt)} />
        </Card.Content>
      </Card>
    </div>
  );
}
