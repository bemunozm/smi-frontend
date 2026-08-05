# Contratos de datos — Dashboard (bloque Núcleo)

El `DashboardView` (`src/views/DashboardView.tsx`) mezcla datos **REALES**
(Terreno, ya integrado a `main`) con datos **mock** (Flota/Inventario y
Mantenimiento, todavía sin integrar). Este documento lleva el estado de
cada pieza para que Benjamin lo siga con el equipo.

Las piezas cableadas muestran un chip discreto **"Real"** junto a su
título; el resto sigue con el chip de cabecera **"Datos parcialmente de
ejemplo"** como aviso.

## Terreno (Alexander) — CABLEADO ✅

Integrado a `main` (`smi-backend@651dc6d`, migración
`20260805151748_terreno_domain`). Capa de lectura propia (NO se importa de
`src/modules/terreno/**`, que es dominio de otro equipo):

- `src/types/terreno.ts` — schemas Zod del shape real (`Hallazgo`,
  `TrabajoExtraordinario`) + envolturas `{ data, message }`.
- `src/api/HallazgosAPI.ts` / `src/api/TrabajosExtraAPI.ts` — `list()`,
  patrón axios + try/catch + `toDomainError` (de `lib/api-error.ts`).
- `src/hooks/useHallazgos.ts` / `src/hooks/useTrabajosExtra.ts` — los
  `useQuery` reales (`queryKey: ['hallazgos']` / `['trabajos-extra']`).
- `src/config/dashboard-aggregations.ts` — funciones puras de agregación en
  cliente (el backend no expone filtro/paginación/agregación todavía).
- `src/hooks/useDashboard.ts` — envuelve las queries reales + agregación en
  los mismos hooks que ya consumía `DashboardView` (`useHallazgosRecientes`,
  `useHallazgosTendencia`, `useTrabajosExtraordinariosMensual`) más uno
  nuevo (`useHallazgosAbiertosResumen`) para el KPI.

**OJO de shape**: el backend llama **`prioridad`** al campo de severidad
del hallazgo, no `criticidad` — se remapea explícitamente en
`dashboard-aggregations.ts#hallazgosRecientes` /
`#hallazgosAbiertosPorPrioridad`. La ruta real de trabajos extra es
`GET /api/trabajos-extra` (no `/api/trabajos-extraordinarios`, como decía
una versión anterior de este documento).

| Pieza | Endpoint real | Cómo se calcula |
|---|---|---|
| KPI **"Hallazgos abiertos"** (+ desglose por prioridad) | `GET /api/hallazgos` | Cuenta `estado === 'ABIERTO'` sobre la lista completa; desglosa por `prioridad` para el subtítulo. |
| Lista **"Hallazgos recientes"** | `GET /api/hallazgos` | Top 5 del listado (el backend ya devuelve `orderBy fecha desc`), remapeado a `HallazgoResumen`. |
| Gráfico **"Tendencia de hallazgos"** | `GET /api/hallazgos` | Agrupado por **semana de reporte** (`fecha`, lunes ISO en UTC), últimas 8. Dentro de cada semana: `CERRADO` → serie "cerrados", `ABIERTO`/`EN_PROCESO` → serie "abiertos". El modelo no tiene fecha de cierre, así que NO es "cuántos se cerraron esa semana" — es "de lo reportado esa semana, qué sigue pendiente vs. qué ya se resolvió". |
| Gráfico **"Horas extraordinarias por mes"** | `GET /api/trabajos-extra` | Agrupado por mes de `fecha`, sumando `totalHoras`, últimos 6 meses. |

**KPI "Ingresos trabajos extra" — ELIMINADO** (no "pendiente"): el campo
`monto` no existe en el modelo real de `TrabajoExtraordinario` (solo
`totalHoras`, calculado server-side). No hay forma de mostrar una cifra en
CLP con el shape actual — se retiró la card en vez de dejarla rota o con un
número inventado. El dato de horas que hubiera alimentado un KPI de
ingresos ya se ve en el gráfico "Horas extraordinarias por mes".

Volumen de datos bajo (seed: 3 hallazgos, 2 trabajos extra) → agregación en
cliente es aceptable por ahora. Si el dominio crece, pedir a Alexander
filtro por `estado`/rango de fechas y/o un endpoint de agregación en vez de
traer el listado completo.

## Pendientes por dominio

### Flota/Inventario (Amin) — MOCK

| Campo/pieza | Fuente real esperada | Estado |
|---|---|---|
| KPI `equiposDisponibles.{disponibles,total}` | `GET /api/equipos`, contar `estado === 'DISPONIBLE'` sobre el total. Ideal: endpoint de agregación. | Endpoint no existe aún en `main`. |
| KPI `insumosBajoMinimo` | Endpoint que filtre `stockActual < stockMinimo`. | Endpoint no existe aún. |
| Dona **"Composición de la flota"** | `GET /api/equipos`, agrupado por `estado`. Los conteos deben sumar `equiposDisponibles.total`. | Endpoint no existe aún. |
| Tabla **"Insumos bajo stock mínimo"** | Mismo endpoint que `insumosBajoMinimo`. | Endpoint no existe aún. |

### Mantenimiento (Joaquín) — MOCK, Fase 2

| Campo/pieza | Fuente real esperada | Estado |
|---|---|---|
| KPI `proximasMantenciones` | Motor preventivo por umbral de horómetro. | No existe aún — Fase 2. |
| KPI `cumplimientoPreventivoPct` | % de mantenciones preventivas ejecutadas dentro del umbral, sobre el total programado. | No existe aún — Fase 2. |
| Tabla **"Próximas mantenciones"** | Mismo motor preventivo. | No existe aún — Fase 2. |

El patrón para activar cada una de estas piezas sigue siendo el mismo:
reemplazar el `mockResponse` de la función correspondiente en
`api/DashboardAPI.ts` por `axiosInstance.get(...)`, parsear con el
`*ResponseSchema` real y — si hace falta agregación en cliente — replicar
el patrón que dejó Terreno en `config/dashboard-aggregations.ts`.

## Shape esperado (referencia rápida)

Ver `src/types/dashboard.ts` (contrato de SALIDA que consume la vista) y
`src/types/terreno.ts` (shape real de ENTRADA de Terreno) para los schemas
Zod completos. Resumen del contrato de salida:

```ts
DashboardSummary = { // MOCK — Flota/Inventario + Mantenimiento
  equiposDisponibles: { disponibles: number; total: number };
  proximasMantenciones: number;
  cumplimientoPreventivoPct: number;
  insumosBajoMinimo: number;
}

HallazgoResumen = { // REAL — derivado de Hallazgo (types/terreno.ts)
  id: string;
  equipo: string;       // ← Hallazgo.equipo.codigo
  descripcion: string;
  criticidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'; // ← Hallazgo.prioridad
  estado: 'ABIERTO' | 'EN_PROCESO' | 'CERRADO';
  fecha: string; // ISO 8601
}

MantencionProxima = { // MOCK — Mantenimiento, Fase 2
  id: string;
  equipo: string;
  tipo: 'PREVENTIVA' | 'CORRECTIVA';
  horometroRestante: number; // horas, 0 = umbral alcanzado
}

FlotaComposicionItem = { // MOCK — Flota/Inventario
  estado: 'DISPONIBLE' | 'EN_RUTA' | 'EN_MANTENCION' | 'DE_BAJA';
  cantidad: number;
}

HallazgoTendenciaSemana = { // REAL — agregado en cliente
  semana: string; // etiqueta corta, ej. "4 ago"
  abiertos: number;
  cerrados: number;
}

TrabajoExtraordinarioMes = { // REAL — agregado en cliente
  mes: string; // etiqueta corta, ej. "Ago"
  horas: number; // horas máquina — no hay campo de ingresos en el modelo real
}

InsumoBajoStock = { // MOCK — Flota/Inventario
  id: string;
  insumo: string;
  stockActual: number;
  stockMinimo: number;
}
```

`DashboardSummary` sigue llegando envuelta en `{ data, message }` (mock,
mismo formato que el resto del backend). Los tipos de Terreno YA NO llegan
envueltos como salida — la envoltura `{ data, message }` de Terreno se
valida en la ENTRADA (`types/terreno.ts`), antes de la agregación en
cliente.
