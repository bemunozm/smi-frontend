import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, Chip, Dropdown, Label, toast } from '@heroui/react';
import type { Key } from '@heroui/react';

import { logout, LogoutBlockedError } from '../lib/logout';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { requestSync, useSyncState } from '../offline/replay';
import { useOutboxOps } from '../offline/useOutboxOps';
import { useUiStore } from '../store/ui';
import { isRole } from '../types/roles';
import { roleChipColor } from '../config/role-colors';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { PrepChecklist } from '../components/sync/PrepChecklist';
import { SyncBadge } from '../components/sync/SyncBadge';
import { SyncOpsList } from '../components/sync/SyncOpsList';
import { SyncSheet } from '../components/sync/SyncSheet';

function initialsFrom(name: string | undefined, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function UserIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="15">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="15">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

/**
 * Menú de usuario: el avatar es el trigger de un `Dropdown` (HeroUI) que
 * muestra el resumen de cuenta (avatar/nombre/email/chip de rol, no
 * interactivo — vive en `Dropdown.Popover` pero fuera de `Dropdown.Menu`)
 * y debajo las acciones reales ("Ver perfil", "Cerrar sesión") como
 * `Dropdown.Item`. `useCurrentUser()` sigue siendo la única fuente de
 * verdad de la sesión.
 */
export function Topbar() {
  const { user } = useCurrentUser();
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const navigate = useNavigate();
  const sync = useSyncState(user?.id);
  const ops = useOutboxOps(user?.id);
  const [syncAbierta, setSyncAbierta] = useState(false);

  const role = user && isRole(user.role) ? user.role : null;

  const handleAction = (key: Key): void => {
    if (key === 'profile') {
      navigate('/perfil');
      return;
    }
    if (key === 'sync') {
      setSyncAbierta(true);
      return;
    }
    if (key === 'logout') {
      // `logout()` (`lib/logout.ts`) hace signOut + limpia TanStack Query y
      // Cache Storage privado + navega — ver ese archivo para el porqué
      // (SEGURIDAD M1, RFC R2-storage). Se
      // bloquea si `user.id` tiene operaciones sin sincronizar en el outbox
      // (realista solo para SUPERVISOR, que en la práctica vive en
      // `TerrenoLayout` — pasa el `userId` igual acá por si algún día un
      // outbox se usa fuera de Terreno).
      void logout(navigate, user?.id).catch((error: unknown) => {
        if (error instanceof LogoutBlockedError) {
          toast.danger(error.message, {
            description: 'Los registros quedan guardados en el equipo — no se pierden.',
            actionProps: { children: 'Sincronizar ahora', onPress: () => requestSync() },
          });
          return;
        }
        throw error;
      });
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface-secondary px-4">
      <Button isIconOnly aria-label="Abrir menú" className="lg:hidden" onPress={toggleSidebar} variant="ghost">
        <svg
          aria-hidden="true"
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="20"
        >
          <line x1="3" x2="21" y1="6" y2="6" />
          <line x1="3" x2="21" y1="12" y2="12" />
          <line x1="3" x2="21" y1="18" y2="18" />
        </svg>
      </Button>

      <div className="hidden md:block" />

      {user ? (
        <div className="flex items-center gap-1">
          <SyncBadge sync={sync} onPress={() => setSyncAbierta(true)} />
          <NotificationBell />

          <Dropdown>
            <Button aria-label="Menú de usuario" className="h-auto gap-2 px-1.5 py-1" variant="ghost">
              <Avatar size="sm">
                {user.image ? <Avatar.Image alt={user.name} src={user.image} /> : null}
                <Avatar.Fallback>{initialsFrom(user.name, user.email)}</Avatar.Fallback>
              </Avatar>
              <span className="hidden text-sm font-medium text-foreground sm:inline">
                {user.name || user.email}
              </span>
            </Button>
            <Dropdown.Popover placement="bottom end">
              <div className="flex items-center gap-3 px-3 py-3">
                <Avatar size="md">
                  {user.image ? <Avatar.Image alt={user.name} src={user.image} /> : null}
                  <Avatar.Fallback>{initialsFrom(user.name, user.email)}</Avatar.Fallback>
                </Avatar>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-medium text-foreground">
                    {user.name || user.email}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  {role ? (
                    <Chip className="w-fit" color={roleChipColor(role)} size="sm" variant="soft">
                      {role}
                    </Chip>
                  ) : null}
                </div>
              </div>
              <Dropdown.Menu onAction={handleAction}>
                <Dropdown.Item id="profile" textValue="Ver perfil">
                  <UserIcon />
                  <Label>Ver perfil</Label>
                </Dropdown.Item>
                <Dropdown.Item id="sync" textValue="Sincronización y uso sin señal">
                  <Label>Sincronización y uso sin señal</Label>
                </Dropdown.Item>
                <Dropdown.Item id="logout" textValue="Cerrar sesión" variant="danger">
                  <SignOutIcon />
                  <Label>Cerrar sesión</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      ) : null}
      {syncAbierta ? (
        <SyncSheet sync={sync} onClose={() => setSyncAbierta(false)}>
          <SyncOpsList ops={ops} userId={user?.id} />
          <PrepChecklist
            role={role}
            titulo="Antes de trabajar sin señal"
            descripcion="Precarga las listas de las pantallas de tu rol (equipos, inventario, sucursales, operadores, mantenimiento) para que abran igual sin señal."
          />
        </SyncSheet>
      ) : null}
    </header>
  );
}
