import { useMemo, useState } from 'react'
import { ORDENES_MOCK } from '../data/mock'
import { estadoOTLabel, type EstadoOTUILabel } from '../status-styles'
import type { FiltroOT, OrdenTrabajo } from '../types'

const FILTRO_A_LABEL: Record<Exclude<FiltroOT, 'TODAS'>, EstadoOTUILabel> = {
  ABIERTA: 'ABIERTA',
  PROCESO: 'EN PROCESO',
  CERRADA: 'CERRADA',
}

export function useOrdenes() {
  // TODO(sprint0): reemplazar por useQuery({ queryKey: ['ordenes'], queryFn: () => api.get('/api/mantenimiento/ordenes') })
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>(ORDENES_MOCK)
  const [filtro, setFiltro] = useState<FiltroOT>('TODAS')

  const stats = useMemo(() => {
    let abiertas = 0
    let enProceso = 0
    let cerradas = 0
    for (const orden of ordenes) {
      const label = estadoOTLabel(orden.estado)
      if (label === 'ABIERTA') abiertas += 1
      else if (label === 'EN PROCESO') enProceso += 1
      else cerradas += 1
    }
    return { abiertas, enProceso, cerradas }
  }, [ordenes])

  const ordenesFiltradas = useMemo(() => {
    if (filtro === 'TODAS') return ordenes
    const label = FILTRO_A_LABEL[filtro]
    return ordenes.filter((orden) => estadoOTLabel(orden.estado) === label)
  }, [ordenes, filtro])

  function toggleTarea(ordenId: string, tareaId: string) {
    // TODO(sprint0): useMutation(...) + queryClient.invalidateQueries({ queryKey: ['ordenes'] })
    setOrdenes((prev) =>
      prev.map((orden) =>
        orden.id !== ordenId
          ? orden
          : {
              ...orden,
              tareas: orden.tareas.map((tarea) =>
                tarea.id !== tareaId ? tarea : { ...tarea, hecha: !tarea.hecha },
              ),
            },
      ),
    )
  }

  function crearOrden() {
    // TODO(sprint0): useMutation(...) + queryClient.invalidateQueries({ queryKey: ['ordenes'] })
    // Placeholder de MVP: el formulario real de creación de OT se implementa junto a React Hook Form en Sprint 0.
  }

  return { ordenesFiltradas, stats, filtro, setFiltro, toggleTarea, crearOrden }
}
