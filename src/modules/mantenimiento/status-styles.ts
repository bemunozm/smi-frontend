// Helper centralizado de estilos semánticos (estado/prioridad) para no repetir
// clases de chips/badges por toda la UI. Fondos tenues + texto de color, con
// buen contraste tanto en light como en dark.

import type {
  EstadoActividad,
  EstadoOT,
  EstadoPreventivo,
  OrigenActividad,
  OrigenOT,
  Prioridad,
  TipoOT,
} from './types'

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

/** Fondo tenue + texto de color, para chips/badges. */
export const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  danger: 'bg-red-500/15 text-red-700 dark:text-red-400',
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-primary/10 text-primary',
}

/** Solo el color de texto, para valores destacados (stat tiles, etc). */
export const TONE_TEXT_CLASSES: Record<Tone, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  neutral: 'text-foreground',
  info: 'text-primary',
}

/** Fondo sólido, para el relleno de progress bars. */
export const TONE_BAR_CLASSES: Record<Tone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  neutral: 'bg-muted-foreground/40',
  info: 'bg-primary',
}

// ---------- Estado OT ----------

export type EstadoOTUILabel = 'ABIERTA' | 'EN PROCESO' | 'CERRADA'

/** El backend maneja 5 estados; al mecánico se le muestran solo 3 agrupados. */
export function estadoOTLabel(estado: EstadoOT): EstadoOTUILabel {
  switch (estado) {
    case 'PENDIENTE':
    case 'ASIGNADA':
      return 'ABIERTA'
    case 'EN_PROCESO':
      return 'EN PROCESO'
    case 'COMPLETADA':
    case 'CANCELADA':
      return 'CERRADA'
  }
}

export function estadoOTTone(estado: EstadoOT): Tone {
  switch (estado) {
    case 'PENDIENTE':
    case 'ASIGNADA':
      return 'neutral'
    case 'EN_PROCESO':
      return 'info'
    case 'COMPLETADA':
      return 'success'
    case 'CANCELADA':
      return 'neutral'
  }
}

// ---------- Prioridad ----------

export function prioridadLabel(prioridad: Prioridad): string {
  switch (prioridad) {
    case 'CRITICA':
      return 'CRÍTICA'
    case 'ALTA':
      return 'ALTA'
    case 'MEDIA':
      return 'MEDIA'
    case 'BAJA':
      return 'BAJA'
  }
}

export function prioridadTone(prioridad: Prioridad): Tone {
  switch (prioridad) {
    case 'CRITICA':
    case 'ALTA':
      return 'danger'
    case 'MEDIA':
      return 'warning'
    case 'BAJA':
      return 'success'
  }
}

/** Acento del borde izquierdo de OrdenCard: distingue CRÍTICA de ALTA aunque compartan tono de chip. */
export function prioridadAccentBorderClass(prioridad: Prioridad): string {
  switch (prioridad) {
    case 'CRITICA':
      return 'border-l-red-600'
    case 'ALTA':
      return 'border-l-orange-500'
    case 'MEDIA':
      return 'border-l-amber-400'
    case 'BAJA':
      return 'border-l-emerald-400'
  }
}

// ---------- Tipo / Origen OT ----------

export function tipoOTLabel(tipo: TipoOT): string {
  return tipo === 'CORRECTIVA' ? 'Correctiva' : 'Preventiva'
}

export function origenOTLabel(origen: OrigenOT, detalle?: string): string {
  const base =
    origen === 'HALLAZGO' ? 'Hallazgo' : origen === 'PREVENTIVO' ? 'Motor preventivo' : 'Actividad'
  return detalle ? `${base} · ${detalle}` : base
}

// ---------- Motor preventivo ----------

export function estadoPreventivoLabel(estado: EstadoPreventivo): string {
  switch (estado) {
    case 'AL_DIA':
      return 'AL DÍA'
    case 'PROXIMA':
      return 'PRÓXIMA'
    case 'ALERTA':
      return 'ALERTA'
  }
}

export function estadoPreventivoTone(estado: EstadoPreventivo): Tone {
  switch (estado) {
    case 'AL_DIA':
      return 'success'
    case 'PROXIMA':
      return 'warning'
    case 'ALERTA':
      return 'danger'
  }
}

// ---------- Actividades ----------

export function estadoActividadLabel(estado: EstadoActividad): string {
  return estado === 'COMPLETADA' ? 'COMPLETADA' : 'PENDIENTE'
}

export function estadoActividadTone(estado: EstadoActividad): Tone {
  return estado === 'COMPLETADA' ? 'success' : 'neutral'
}

export function origenActividadLabel(origen: OrigenActividad): string {
  switch (origen) {
    case 'HALLAZGO':
      return 'Hallazgo'
    case 'EQUIPO':
      return 'Equipo'
    case 'MANUAL':
      return 'Libre'
  }
}

/** Label/placeholder/hint del campo de referencia del formulario de actividades, según el origen elegido. */
export function origenActividadCampo(origen: OrigenActividad): {
  label: string
  placeholder: string
  hint: string
} {
  switch (origen) {
    case 'HALLAZGO':
      return {
        label: 'Referencia del hallazgo',
        placeholder: 'Ej: H-014 o CM-003',
        hint: 'La actividad queda asociada a un hallazgo reportado en terreno.',
      }
    case 'EQUIPO':
      return {
        label: 'Código de equipo',
        placeholder: 'Ej: EX-001',
        hint: 'La actividad queda asociada directamente a un equipo de la flota.',
      }
    case 'MANUAL':
      return {
        label: 'Referencia libre',
        placeholder: 'Ej: Bodega, turno noche...',
        hint: 'Actividad libre, sin equipo ni hallazgo asociado.',
      }
  }
}
