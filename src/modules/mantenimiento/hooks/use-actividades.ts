import { useRef, useState } from 'react'
import { ACTIVIDADES_MOCK, MECANICOS } from '../data/mock'
import type { Actividad, Mecanico, OrigenActividad } from '../types'

export function useActividades() {
  // TODO(sprint0): reemplazar por useQuery({ queryKey: ['actividades'], queryFn: () => api.get('/api/mantenimiento/actividades') })
  const [actividades, setActividades] = useState<Actividad[]>(ACTIVIDADES_MOCK)
  const contador = useRef(ACTIVIDADES_MOCK.length)

  const [origen, setOrigen] = useState<OrigenActividad>('EQUIPO')
  const [referencia, setReferencia] = useState('')
  const [asignadoA, setAsignadoA] = useState<Mecanico>(MECANICOS['L. Fuentes'])
  const [descripcion, setDescripcion] = useState('')

  function toggleActividad(id: string) {
    // TODO(sprint0): useMutation(...) + queryClient.invalidateQueries({ queryKey: ['actividades'] })
    setActividades((prev) =>
      prev.map((actividad) =>
        actividad.id !== id
          ? actividad
          : { ...actividad, estado: actividad.estado === 'COMPLETADA' ? 'PENDIENTE' : 'COMPLETADA' },
      ),
    )
  }

  function asignarActividad() {
    // TODO(sprint0): useMutation(...) + queryClient.invalidateQueries({ queryKey: ['actividades'] })
    // TODO(sprint0): migrar a React Hook Form + zodResolver(esquema)
    if (!descripcion.trim()) return
    contador.current += 1
    const nueva: Actividad = {
      id: `ACT-${String(contador.current).padStart(2, '0')}`,
      descripcion: descripcion.trim(),
      origen,
      referencia: referencia.trim(),
      asignadoA,
      estado: 'PENDIENTE',
    }
    setActividades((prev) => [nueva, ...prev])
    setDescripcion('')
    setReferencia('')
  }

  const completadas = actividades.filter((actividad) => actividad.estado === 'COMPLETADA').length

  return {
    actividades,
    completadas,
    total: actividades.length,
    toggleActividad,
    origen,
    setOrigen,
    referencia,
    setReferencia,
    asignadoA,
    setAsignadoA,
    descripcion,
    setDescripcion,
    asignarActividad,
  }
}
