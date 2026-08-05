// Tipos de dominio — Mantenimiento
// Espejo del futuro schema.prisma / esquemas Zod que se formalizarán en Sprint 0.

// ---------- Enums de dominio (union types) ----------

/** Estado real de la OT en el modelo de datos. */
export type EstadoOT = 'PENDIENTE' | 'ASIGNADA' | 'EN_PROCESO' | 'COMPLETADA' | 'CANCELADA'

export type TipoOT = 'CORRECTIVA' | 'PREVENTIVA'

export type OrigenOT = 'MANUAL' | 'PREVENTIVO' | 'HALLAZGO'

export type Prioridad = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA'

export type EstadoActividad = 'PENDIENTE' | 'COMPLETADA'

export type OrigenActividad = 'HALLAZGO' | 'EQUIPO' | 'MANUAL'

export type EstadoPreventivo = 'AL_DIA' | 'PROXIMA' | 'ALERTA'

/** Filtro de la pantalla de órdenes (segmented control). */
export type FiltroOT = 'TODAS' | 'ABIERTA' | 'PROCESO' | 'CERRADA'

// ---------- Refs de solo lectura (propiedad de otros dominios) ----------

/**
 * Propiedad del dominio Flota. En Sprint 0 llega vía API
 * (GET /api/flota/equipos/:id) — acá solo se lee, nunca se escribe.
 */
export interface EquipoRef {
  id: string
  codigo: string
  tipo: string
}

/**
 * Propiedad del dominio Inventario. En Sprint 0 llega vía API
 * (GET /api/inventario/insumos/:id) — el stock se descuenta vía su propia mutación.
 */
export interface InsumoRef {
  id: string
  codigo: string
  nombre: string
  unidad: 'L' | 'u'
  stock: number
  stockMinimo: number
}

// ---------- Personas ----------

export interface Mecanico {
  nombre: string
  iniciales: string
}

// ---------- Órdenes de trabajo ----------

export interface TareaChecklist {
  id: string
  texto: string
  hecha: boolean
}

export interface OrdenTrabajo {
  id: string
  equipo: EquipoRef
  titulo: string
  estado: EstadoOT
  prioridad: Prioridad
  tipo: TipoOT
  hora: string
  origen: OrigenOT
  origenDetalle?: string
  mecanico: Mecanico
  tareas: TareaChecklist[]
}

// ---------- Bitácora / Intervención ----------

export interface IntervencionInsumo {
  insumo: InsumoRef
  cantidad: number
}

export interface Intervencion {
  id: string
  ordenId: string
  tipo: TipoOT
  detalle: string
  horasHombre: number
  horometro: number
  insumos: IntervencionInsumo[]
  cerrada: boolean
}

export interface BitacoraEntrada {
  id: string
  fecha: string
  autor: string
  tipo: TipoOT
  resumen: string
  soloLectura: boolean
}

// ---------- Motor preventivo ----------

export interface Umbral {
  equipo: EquipoRef
  horasUltima: number
  horasUmbral: number
  horasActuales: number
  plan: string
  /** Id de la OT generada para este umbral, si ya existe. */
  otGenerada?: string
}

// ---------- Actividades ----------

export interface Actividad {
  id: string
  descripcion: string
  origen: OrigenActividad
  referencia: string
  asignadoA: Mecanico
  estado: EstadoActividad
}
