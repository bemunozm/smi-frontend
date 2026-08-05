import { EquipoUmbralCard } from '../components'
import { usePreventivo } from '../hooks'

export function PreventivoPage() {
  const { umbrales, avisoPorcentaje, umbralesPorTipo, mensaje, generarOTDesdeAlertas } = usePreventivo()

  const alertas = umbrales.filter((umbral) => umbral.estado === 'ALERTA').length

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Umbrales por horómetro</h1>
        <p className="text-sm text-muted-foreground">Motor preventivo · genera la OT automáticamente al llegar al umbral</p>
      </div>

      <div className="rounded-(--radius) bg-secondary p-4 text-secondary-foreground">
        <p className="text-sm font-semibold">Cómo funciona</p>
        <p className="mt-1.5 text-xs opacity-90">
          Se avisa al equipo de mantención cuando el horómetro llega al {avisoPorcentaje}% del intervalo definido, y
          se crea la orden de trabajo automáticamente al alcanzar el umbral.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {umbralesPorTipo.map((item) => (
            <span
              key={item.tipo}
              className="rounded-full bg-secondary-foreground/10 px-2.5 py-1 text-xs font-medium"
            >
              {item.tipo} · {item.horas} h
            </span>
          ))}
        </div>
      </div>

      {mensaje ? (
        <div className="rounded-(--radius) border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
          {mensaje}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {umbrales.map((umbral) => (
          <EquipoUmbralCard
            key={umbral.equipo.id}
            equipo={umbral.equipo}
            horasActuales={umbral.horasActuales}
            horasUmbral={umbral.horasUmbral}
            pct={umbral.pct}
            estado={umbral.estado}
            horasFaltantes={umbral.horasFaltantes}
            plan={umbral.plan}
            otGenerada={umbral.otGenerada}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={generarOTDesdeAlertas}
        disabled={alertas === 0}
        className="rounded-(--radius) bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        Generar OT de las alertas
      </button>
    </div>
  )
}
