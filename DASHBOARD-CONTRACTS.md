# Contratos de datos — Dashboard (bloque Núcleo)

El `DashboardView` (`src/views/DashboardView.tsx`) hoy consume **datos mock
tipados** desde `src/api/DashboardAPI.ts`, validados contra los schemas Zod
de `src/types/dashboard.ts`. Los dominios que deben alimentarlo en serio
(Terreno, Mantenimiento, Flota/Inventario) todavía no están integrados a
`main`. Este documento es la lista de pendientes para conectar cada dato —
Benjamin la lleva al equipo.

El patrón para "activar" cada uno es siempre el mismo: en
`DashboardAPI.ts`, reemplazar el `mockResponse` de la función
correspondiente por `axiosInstance.get(...)` (o el verbo/endpoint que
corresponda) y parsear la respuesta real con el mismo `*ResponseSchema`. La
vista y los hooks (`useDashboard.ts`) no necesitan cambiar.

## KPIs (`DashboardSummary`)

| Campo | Dominio | Owner | Endpoint / fuente real | Estado |
|---|---|---|---|---|
| `equiposDisponibles.{disponibles,total}` | Flota/Inventario | Amin | `GET /api/equipos`, contar `estado === 'DISPONIBLE'` sobre el total. Ideal: un endpoint de agregación en vez de contar en cliente sobre el listado completo. | Endpoint no existe aún en `main`. |
| `hallazgosAbiertos` | Terreno | Alexander | `GET /api/hallazgos?estado=ABIERTO` → `data.length`. | Endpoint de hallazgos existe en su rama pero **sin filtro/agregación por estado**; hay que pedirlo o contar en cliente sobre el listado completo mientras tanto. |
| `proximasMantenciones` | Mantenimiento | Joaquín | Motor preventivo por umbral de horómetro. | **Fase 2** — el endpoint todavía no existe. |
| `ingresosTrabajosExtra` | Terreno | Alexander | Suma de `monto` sobre `TrabajoExtraordinario`. | ⚠️ **Sujeto a confirmación**: el campo `monto` fue **eliminado** del modelo — pendiente reponerlo con Alexander antes de poder calcular este KPI. |

## Listas

| Lista | Dominio | Owner | Endpoint / fuente real | Estado |
|---|---|---|---|---|
| `HallazgoResumen[]` (hallazgos recientes) | Terreno | Alexander | `GET /api/hallazgos?estado=ABIERTO&limit=5`, orden por fecha desc. | Depende del mismo endpoint de hallazgos de arriba; hoy no soporta `limit`/orden — habría que pedirlo o recortar/ordenar en cliente. |
| `MantencionProxima[]` (próximas mantenciones) | Mantenimiento | Joaquín | Motor preventivo por umbral de horómetro. | **Fase 2** — no existe aún, igual que el KPI de arriba. |

## Shape esperado (referencia rápida)

Ver `src/types/dashboard.ts` para los schemas Zod completos. Resumen:

```ts
DashboardSummary = {
  equiposDisponibles: { disponibles: number; total: number };
  hallazgosAbiertos: number;
  proximasMantenciones: number;
  ingresosTrabajosExtra: number; // CLP
}

HallazgoResumen = {
  id: string;
  equipo: string;
  descripcion: string;
  criticidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  estado: 'ABIERTO' | 'EN_PROCESO' | 'CERRADO';
  fecha: string; // ISO 8601
}

MantencionProxima = {
  id: string;
  equipo: string;
  tipo: 'PREVENTIVA' | 'CORRECTIVA';
  horometroRestante: number; // horas, 0 = umbral alcanzado
}
```

Todas las respuestas reales deben venir envueltas en `{ data, message }`,
igual que `users` — son los `*ResponseSchema` los que validan esa envoltura
completa antes de devolver `.data`.
