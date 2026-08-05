# Contratos de datos — Dashboard (bloque Núcleo)

El `DashboardView` (`src/views/DashboardView.tsx`) mezcla datos **REALES**
(Terreno y Flota/Inventario, ya integrados a `main`) con datos **mock**
(Mantenimiento, todavía sin integrar — Fase 2). Este documento lleva el
estado de cada pieza para que Benjamin lo siga con el equipo.

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

## Flota/Inventario (Amin) — CABLEADO ✅

Integrado a `main` (PR #7/#8). A diferencia de Terreno, NO tiene capa de
lectura propia dentro de Núcleo: `DashboardView` consume DIRECTO los hooks y
tipos del dominio de Amin (Zod + union literal, sin fricción de tipos ni
casts) — el backend ya agrega lo que el dashboard necesita, así que no hace
falta una capa de agregación en cliente como la de Terreno:

- `src/hooks/useEquipos.ts#useResumenFlota` — `GET /api/equipos/resumen`,
  tipo `ResumenFlota` (`src/types/equipo.ts`): `{ total, disponibles, porEstado }`.
  `disponibles`/`total` alimentan el KPI; `porEstado` (ya agregado por
  estado, `Record<EstadoEquipo, number>`) alimenta la dona directo, solo se
  remapea a la forma que espera `Pie` — no se cuenta en cliente.
- `src/hooks/useInventario.ts#useResumenInventario` — `GET /api/inventario/insumos/resumen`,
  tipo `ResumenInventario` (`src/types/inventario.ts`): `{ total, bajoMinimo }`.
  Alimenta el KPI "Insumos bajo mínimo".
- `src/hooks/useInventario.ts#useInsumos({ bajoStock: true })` — `GET /api/inventario/insumos?bajoStock=true`,
  tipo `Insumo[]` (`codigo`/`nombre`/`unidad`/`stock`/`stockMinimo`). Alimenta
  la tabla "Insumos bajo stock mínimo" — mismo dato que el KPI de arriba.
- Colores/labels de estado de equipo: `src/config/flota-colors.ts`
  (`estadoEquipoChipColor`/`estadoEquipoLabel`/`ESTADO_OPTIONS`) — fuente
  única, reusada por `config/dashboard-colors.ts#equipoEstadoChartColor`
  como puente a hex para Recharts. Se eliminó el `EQUIPO_ESTADO_COLOR`
  duplicado que vivía en `dashboard-colors.ts` (estaba desalineado:
  `DE_BAJA` era `default` ahí vs. `danger` en `flota-colors.ts`).

| Pieza | Endpoint real | Cómo se calcula |
|---|---|---|
| KPI **"Equipos disponibles"** | `GET /api/equipos/resumen` | `disponibles`/`total` directo del summary — el backend ya cuenta. |
| KPI **"Insumos bajo mínimo"** | `GET /api/inventario/insumos/resumen` | `bajoMinimo` directo del summary — el backend ya filtra `stock <= stockMinimo`. |
| Dona **"Composición de la flota"** | `GET /api/equipos/resumen` | `porEstado` remapeado a `{estado, cantidad, label, fill}` por estado — sin contar en cliente. |
| Tabla **"Insumos bajo stock mínimo"** | `GET /api/inventario/insumos?bajoStock=true` | Listado ya filtrado por el backend, pintado con `codigo`/`nombre`/`stock`/`stockMinimo`/`unidad`. |

## Pendientes por dominio

### Mantenimiento (Joaquín) — MOCK, Fase 2

| Campo/pieza | Fuente real esperada | Estado |
|---|---|---|
| KPI `proximasMantenciones` | Motor preventivo por umbral de horómetro. | No existe aún — Fase 2. El umbral hoy es por `tipoEquipo`, sin instancia ni "última mantención". |
| KPI `cumplimientoPreventivoPct` | % de mantenciones preventivas ejecutadas dentro del umbral, sobre el total programado. | No existe aún — Fase 2. |
| Tabla **"Próximas mantenciones"** | Mismo motor preventivo. | No existe aún — Fase 2. |

El patrón para activar estas piezas sigue el mismo camino que dejaron
Terreno y Flota/Inventario: reemplazar el `mockResponse` de
`api/DashboardAPI.ts#getSummary`/`#getMantencionesProximas` por
`axiosInstance.get(...)` sobre el endpoint real del motor preventivo,
consumiendo directo los hooks/tipos de Mantenimiento cuando existan (sin
capa propia en Núcleo, mismo criterio que Flota/Inventario).

## Shape esperado (referencia rápida)

Ver `src/types/dashboard.ts` (contrato de SALIDA que consume la vista, hoy
solo Terreno + Mantenimiento-mock), `src/types/terreno.ts` (shape real de
ENTRADA de Terreno) y `src/types/equipo.ts` / `src/types/inventario.ts`
(shape real de Flota/Inventario, consumidos directo, sin tipo propio de
Núcleo) para los schemas Zod completos. Resumen:

```ts
// types/dashboard.ts — MOCK, único dominio pendiente (Mantenimiento, Fase 2)
DashboardSummary = {
  proximasMantenciones: number;
  cumplimientoPreventivoPct: number;
}

MantencionProxima = { // MOCK — Mantenimiento, Fase 2
  id: string;
  equipo: string;
  tipo: 'PREVENTIVA' | 'CORRECTIVA';
  horometroRestante: number; // horas, 0 = umbral alcanzado
}

// types/dashboard.ts — REAL, derivado en cliente de Terreno
HallazgoResumen = {
  id: string;
  equipo: string;       // ← Hallazgo.equipo.codigo
  descripcion: string;
  criticidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'; // ← Hallazgo.prioridad
  estado: 'ABIERTO' | 'EN_PROCESO' | 'CERRADO';
  fecha: string; // ISO 8601
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

// types/equipo.ts — REAL, consumido directo (sin tipo propio de Núcleo)
ResumenFlota = {
  total: number;
  disponibles: number;
  porEstado: Record<'DISPONIBLE' | 'EN_RUTA' | 'EN_MANTENCION' | 'DE_BAJA', number>;
}

// types/inventario.ts — REAL, consumido directo (sin tipo propio de Núcleo)
ResumenInventario = { total: number; bajoMinimo: number };

Insumo = { // filtrado server-side con `?bajoStock=true`
  id: string; codigo: string; nombre: string;
  unidad: 'UNIDAD' | 'LITRO' | 'KILOGRAMO' | 'METRO';
  stock: number; stockMinimo: number;
}
```

`DashboardSummary` sigue llegando envuelta en `{ data, message }` (mock,
mismo formato que el resto del backend). Los tipos de Terreno YA NO llegan
envueltos como salida — la envoltura `{ data, message }` de Terreno se
valida en la ENTRADA (`types/terreno.ts`), antes de la agregación en
cliente.
