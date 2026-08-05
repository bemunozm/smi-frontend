import { IconCheck, SectionLabel, SegmentedControl } from '../components/ui'
import { BitacoraEntry, InsumoRow } from '../components'
import { useIntervencion } from '../hooks'
import { formatNumber } from '../format'
import type { TipoOT } from '../types'

const TIPOS: { value: TipoOT; label: string }[] = [
  { value: 'CORRECTIVA', label: 'CORRECTIVA' },
  { value: 'PREVENTIVA', label: 'PREVENTIVA' },
]

const AYUDA_TIPO: Record<TipoOT, string> = {
  CORRECTIVA: 'Se registra una falla puntual detectada en terreno u originada por un hallazgo.',
  PREVENTIVA: 'Se registra una mantención programada según el plan de horómetro del equipo.',
}

export function BitacoraPage() {
  const {
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
  } = useIntervencion()

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Registrar mantención</h1>
        <p className="text-sm text-muted-foreground">
          Queda en solo lectura al cerrar la intervención · descuenta stock automáticamente
        </p>
      </div>

      <div className="rounded-(--radius) border border-border bg-card p-3">
        <p className="text-xs text-muted-foreground">Orden de trabajo</p>
        <p className="mt-1 font-mono text-sm font-semibold text-foreground">
          {intervencion.ordenId} · {orden?.equipo.codigo} · {orden?.equipo.tipo}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <SegmentedControl options={TIPOS} value={intervencion.tipo} onChange={setTipo} />
        <p className="text-xs text-muted-foreground">{AYUDA_TIPO[intervencion.tipo]}</p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase">Detalle de lo realizado</span>
        <textarea
          value={intervencion.detalle}
          onChange={(event) => setDetalle(event.target.value)}
          disabled={soloLectura}
          rows={3}
          placeholder="Describe el trabajo realizado..."
          className="resize-none rounded-(--radius) border border-border bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Horas hombre</span>
          <input
            type="number"
            min={0}
            value={intervencion.horasHombre}
            disabled={soloLectura}
            onChange={(event) => setHorasHombre(Number(event.target.value))}
            className="rounded-(--radius) border border-border bg-card p-3 text-sm text-foreground disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Horómetro</span>
          <input
            type="number"
            min={0}
            value={intervencion.horometro}
            disabled={soloLectura}
            onChange={(event) => setHorometro(Number(event.target.value))}
            className="rounded-(--radius) border border-border bg-card p-3 text-sm text-foreground disabled:opacity-60"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>Insumos usados</SectionLabel>
        <div className="flex flex-col gap-2">
          {insumosConImpacto.map((item) => (
            <InsumoRow
              key={item.insumo.id}
              insumo={item.insumo}
              cantidad={item.cantidad}
              antes={item.antes}
              despues={item.despues}
              bajoMinimo={item.bajoMinimo}
              onIncrement={() => ajustarInsumo(item.insumo.id, 1)}
              onDecrement={() => ajustarInsumo(item.insumo.id, -1)}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-(--radius) border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Ítems a descontar</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{formatNumber(impacto.itemsADescontar)}</p>
        </div>
        <div
          className={`rounded-(--radius) border p-3 ${
            impacto.alertasStock > 0 ? 'border-red-500/30 bg-red-500/10' : 'border-border bg-card'
          }`}
        >
          <p className={`text-xs ${impacto.alertasStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
            Alertas de stock
          </p>
          <p
            className={`mt-1 text-lg font-semibold ${
              impacto.alertasStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'
            }`}
          >
            {impacto.alertasStock}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={cerrarIntervencion}
        disabled={soloLectura}
        className="flex items-center justify-center gap-2 rounded-(--radius) bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        <IconCheck className="h-4 w-4" />
        {soloLectura ? 'Intervención cerrada' : 'Cerrar intervención'}
      </button>

      <div className="flex flex-col gap-2">
        <SectionLabel>Bitácora de la OT</SectionLabel>
        <div className="flex flex-col gap-2">
          {bitacora.map((entrada) => (
            <BitacoraEntry key={entrada.id} entrada={entrada} />
          ))}
        </div>
      </div>
    </div>
  )
}
