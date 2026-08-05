import { useMemo, useState } from 'react'
import { BITACORA_MOCK, INTERVENCION_MOCK, ORDENES_MOCK } from '../data/mock'
import type { Intervencion, InsumoRef, TipoOT } from '../types'

const PASO_LITROS = 5
const PASO_UNIDADES = 1

function pasoPara(unidad: InsumoRef['unidad']): number {
  return unidad === 'L' ? PASO_LITROS : PASO_UNIDADES
}

export function useIntervencion() {
  // TODO(sprint0): reemplazar por useQuery({ queryKey: ['intervencion', ordenId], queryFn: () => api.get(`/api/mantenimiento/ordenes/${ordenId}/intervencion`) })
  const orden = ORDENES_MOCK.find((o) => o.id === INTERVENCION_MOCK.ordenId)
  const [intervencion, setIntervencion] = useState<Intervencion>(INTERVENCION_MOCK)
  const bitacora = BITACORA_MOCK

  const soloLectura = intervencion.cerrada

  function setTipo(tipo: TipoOT) {
    setIntervencion((prev) => ({ ...prev, tipo }))
  }

  function setDetalle(detalle: string) {
    setIntervencion((prev) => ({ ...prev, detalle }))
  }

  function setHorasHombre(horasHombre: number) {
    setIntervencion((prev) => ({ ...prev, horasHombre: Math.max(0, horasHombre || 0) }))
  }

  function setHorometro(horometro: number) {
    setIntervencion((prev) => ({ ...prev, horometro: Math.max(0, horometro || 0) }))
  }

  function ajustarInsumo(insumoId: string, direccion: 1 | -1) {
    setIntervencion((prev) => ({
      ...prev,
      insumos: prev.insumos.map((item) => {
        if (item.insumo.id !== insumoId) return item
        const paso = pasoPara(item.insumo.unidad) * direccion
        return { ...item, cantidad: Math.max(0, item.cantidad + paso) }
      }),
    }))
  }

  // Cálculo estrella de la pantalla: stock antes → después por insumo, con alerta si queda bajo mínimo.
  const insumosConImpacto = useMemo(
    () =>
      intervencion.insumos.map((item) => {
        const antes = item.insumo.stock
        const despues = antes - item.cantidad
        const bajoMinimo = despues < item.insumo.stockMinimo
        return { ...item, antes, despues, bajoMinimo }
      }),
    [intervencion.insumos],
  )

  const impacto = useMemo(() => {
    const itemsADescontar = insumosConImpacto.reduce((acc, item) => acc + item.cantidad, 0)
    const alertasStock = insumosConImpacto.filter((item) => item.bajoMinimo).length
    return { itemsADescontar, alertasStock }
  }, [insumosConImpacto])

  function cerrarIntervencion() {
    // TODO(sprint0): useMutation(...) + queryClient.invalidateQueries({ queryKey: ['ordenes', 'intervencion'] })
    // — también descuenta stock real vía la mutación del dominio Inventario.
    setIntervencion((prev) => ({ ...prev, cerrada: true }))
  }

  return {
    orden,
    intervencion,
    soloLectura,
    bitacora,
    insumosConImpacto,
    impacto,
    setTipo,
    setDetalle,
    setHorasHombre,
    setHorometro,
    ajustarInsumo,
    cerrarIntervencion,
  }
}
