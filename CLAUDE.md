# SMI Frontend — Guía de arquitectura (para agentes de IA)

SPA del **Sistema de Mantenimiento e Inventario (SMI)**. Este archivo define la arquitectura, convenciones y el **patrón CRUD estándar** a seguir. **Léelo antes de escribir código.** Estas reglas sobre-escriben cualquier comportamiento por defecto.

## Stack (decidido, no cambiar sin acuerdo del equipo)
- **React 19** + **Vite 8** + **TypeScript strict** (prohibido `any`).
- **HeroUI v3** (`@heroui/react` + `@heroui/styles`) sobre **Tailwind CSS v4**. UI SIEMPRE con componentes HeroUI (sus variantes + la paleta por tokens); no hardcodear componentes ni colores.
- **TanStack Query v5** (estado de servidor) · **Zustand** (estado de UI transversal) · **React Hook Form** + **Zod** (`@hookform/resolvers`) · **axios** (dentro de las funciones de TanStack) · **react-router-dom v7**.
- **Better Auth** (cliente) para auth por sesión/cookies.

## Estructura de carpetas (respetarla)
```
src/
├── api/         # <X>API.ts — funciones de petición (queryFn/mutationFn): axios + try/catch + Zod
├── components/  # componentes reutilizables (ej. ProtectedRoute, GuestRoute)
├── config/      # env.ts (única fuente de VITE_API_URL), nav-items.ts, role-colors.ts
├── context/     # AppProviders.tsx (QueryClientProvider y demás providers)
├── hooks/       # useX.ts (useQuery + useMutation) y useCurrentUser
├── layout/      # AppLayout, Sidebar, Topbar
├── lib/         # instancias configuradas: axios.ts, query-client.ts, auth-client.ts, api-error.ts (toDomainError compartido)
├── store/       # ui.ts (Zustand — SOLO estado de UI, nunca auth)
├── types/       # schemas Zod + tipos: roles.ts, user.ts, ...
├── views/       # una vista por pantalla — SE LLAMAN *View, NO *Page
├── routes.tsx   # árbol de rutas (react-router-dom)
├── main.tsx
└── index.css    # tokens del design system + fuentes + overrides HeroUI
```
Los archivos son **named exports** (no `export default`). Sin path alias — imports relativos.

## Patrón CRUD estándar (calca `users` de punta a punta)
Cada dominio se implementa igual. Este es EL patrón — la ESTRUCTURA (axios +
try/catch + Zod + queryFn) se calca por dominio, pero el helper de errores
es único y compartido en `lib/`, no se duplica:

```
lib/axios.ts            instancia axios (baseURL de config/env, withCredentials)
lib/api-error.ts         toDomainError/extractBackendMessage — COMPARTIDO, cada
                        api/<X>API.ts lo IMPORTA, nunca lo redefine local
   ↓
api/<X>API.ts           funciones async: axios + try/catch + Zod.parse(response COMPLETA) + return .data
                        el catch llama a toDomainError (importado de lib/api-error)
                        → mensaje del backend primero, sino fallback
   ↓
types/<x>.ts            <X>Schema (zod) + tipos z.infer + <X>ResponseSchema/<X>ListResponseSchema
   ↓
hooks/use<X>s.ts        useX() = useQuery ; useCreateX/useUpdateX/useDeleteX = useMutation
                        FEEDBACK CENTRALIZADO en el hook: onSuccess → invalidateQueries + toast.success
                                                          onError   → toast.danger(error.message)
   ↓
views/<X>View.tsx       SOLO UI. Consume los hooks. mutate(payload, { onSuccess: () => close() })
                        loading vía mutation.isPending. Nada de try/catch ni toasts en la vista.
```

Reglas del patrón:
- **Validar SIEMPRE la response con Zod** (la envoltura completa `{ data, message }`). Los schemas viven en `types/` y sirven tanto para validar respuestas como para tipar/validar forms (RHF + `zodResolver`).
- **Errores**: `lib/api-error.ts#toDomainError` es la única fuente del mensaje en TODO el frontend (importado por cada `api/<X>API.ts`, nunca reimplementado) → para errores HTTP usa `error.response.data.message` (backend) y, si no viene, un **fallback amigable** (nunca el mensaje técnico de axios); `ZodError` → mensaje de "respuesta inválida".
- **Feedback (toasts) + invalidación viven en los hooks**, no en las vistas. La vista solo cierra el modal / navega en su `onSuccess` local. Ambos `onSuccess` (hook + call-site) se ejecutan.
- **`useQueryClient()`** para invalidar (no importar la instancia directamente).

## Autenticación
- **`useSession()`** de Better Auth (`lib/auth-client.ts`) es la **ÚNICA fuente de verdad** de la sesión. Envuelta en `hooks/useCurrentUser`. **NUNCA** guardes el token ni dupliques la sesión en Zustand.
- `signIn.email` / `signOut` desde el cliente. Login-only (no signup: el backend tiene `disableSignUp`).
- Rutas protegidas con `components/ProtectedRoute` (acepta `allowedRoles` para restringir por rol). `GuestRoute` para el login.
- Roles: `ADMIN | SUPERVISOR | MANTENEDOR | OPERADOR` — fuente única en `types/roles.ts` (`ROLES`, `Role`, `isRole`). Reúsala (ej. `z.enum(ROLES)`), no strings mágicos.

## Design system (ya montado en `index.css`)
- **Tema claro cálido**: fondo `#EFEDE9`, texto `#0D0C0A`, accent `#1E50EA`. Tokens en `:root` mapeados a las variables que espera `@heroui/styles` → todos los componentes HeroUI adoptan la paleta.
- **Fuentes** self-hosted (`@fontsource-variable`): `Geist` (UI, `font-sans`), `Space Grotesk` (títulos, `font-display`), `Geist Mono`.
- Ajustes de componentes (campos/botones 48px, radios, labels uppercase) están en `@layer components` de `index.css` — patrón oficial de HeroUI. **No reimplementes componentes ni pongas hex sueltos**: usa los tokens (`bg-danger-soft`, `text-foreground`, chips con `color`, etc.).

## Cómo agregar una vista/dominio
1. `types/<x>.ts` con los schemas Zod. 2. `api/<X>API.ts` (patrón de arriba). 3. `hooks/use<X>s.ts` (query + mutations con feedback). 4. `views/<X>View.tsx` (solo UI, HeroUI). 5. Ruta en `routes.tsx` (dentro de `ProtectedRoute`, con `allowedRoles` si aplica). 6. Ítem en `config/nav-items.ts` (filtrado por rol si corresponde).

## Setup local
```bash
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:3000
npm run dev                   # http://localhost:5173  (el backend debe correr en :3000)
```

## Git (GitHub Flow, Conventional Commits)
- `main` estable y **protegida (PR obligatorio)**. **Nunca push directo a main.**
- Rama por funcionalidad: `feat/<dominio>/<descripcion>` (`fix/…`, `chore/…`, `docs/…`).
- Commits: `tipo(contexto): descripción` en **inglés**, imperativo, ≤100 chars, sin mayúscula inicial ni punto final. Sin co-autoría de IA.

## Prohibiciones
- ❌ `any` (usa `unknown` + type guards) · ❌ `export default` · ❌ vistas llamadas `*Page` (son `*View`)
- ❌ Duplicar la sesión/token en Zustand (usa `useSession`/`useCurrentUser`)
- ❌ `useEffect` + axios manual para datos del server → usa TanStack Query
- ❌ try/catch ni toasts en las vistas → el feedback vive en los hooks
- ❌ Hardcodear colores/componentes → HeroUI + tokens del design system
- ❌ Hardcodear la URL del backend → `config/env.ts` (`VITE_API_URL`) · ❌ push directo a `main`
