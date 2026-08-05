import { useMemo, useRef, useState } from 'react'
import { AVISO_PORCENTAJE, UMBRALES_MOCK, UMBRALES_POR_TIPO } from '../data/mock'
import type { EstadoPreventivo, Umbral } from '../types'

export interface UmbralConProgreso extends Umbral {
  pct: number
  estado: EstadoPreventivo
  horasFaltantes: number
}

function calcularProgreso(umbral: Umbral): UmbralConProgreso {
  const rango = umbral.horasUmbral - umbral.horasUltima
  const avance = umbral.horasActuales - umbral.horasUltima
  const pct = rango > 0 ? Math.round((avance / rango) * 100) : 0
  const estado: EstadoPreventivo = pct >= AVISO_PORCENTAJE ? 'ALERTA' : pct >= 60 ? 'PROXIMA' : 'AL_DIA'
  const horasFaltantes = umbral.horasUmbral - umbral.horasActuales
  return { ...umbral, pct, estado, horasFaltantes }
}

export function usePreventivo() {
  // TODO(sprint0): reemplazar por useQuery({ queryKey: ['umbrales'], queryFn: () => api.get('/api/mantenimiento/preventivo/umbrales') })
  const [umbrales, setUmbrales] = useState<Umbral[]>(UMBRALES_MOCK)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const contadorOT = useRef(150)

  const umbralesConProgreso = useMemo(() => umbrales.map(calcularProgreso), [umbrales])

  function generarOTDesdeAlertas() {
    // TODO(sprint0): useMutation(...) + queryClient.invalidateQueries({ queryKey: ['ordenes', 'umbrales'] })
    let generadas = 0
    setUmbrales((prev) =>
      prev.map((umbral) => {
        const progreso = calcularProgreso(umbral)
        if (progreso.estado === 'ALERTA' && !umbral.otGenerada) {
          generadas += 1
          contadorOT.current += 1
          return { ...umbral, otGenerada: `OT-0${contadorOT.current}` }
        }
        return umbral
      }),
    )
    setMensaje(
      generadas > 0
        ? `Se generaron ${generadas} orden${generadas === 1 ? '' : 'es'} de trabajo.`
        : 'No hay alertas pendientes por generar.',
    )
  }

  return {
    umbrales: umbralesConProgreso,
    avisoPorcentaje: AVISO_PORCENTAJE,
    umbralesPorTipo: UMBRALES_POR_TIPO,
    mensaje,
    generarOTDesdeAlertas,
  }
}
