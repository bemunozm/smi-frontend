import { AlertTriangle, ArrowRight, Clock, Fuel } from 'lucide-react';

import { FotoRespaldoField } from '../flota/FotoRespaldoField';
import { AdBlueCampos } from './AdBlueCampos';
import { Boton, Campo, Form, Hint, Input, Label } from './ui';
import type { CargaTarjeta } from '../../hooks/shift-register-helpers';
import type { UseCargaLivianoResult } from '../../hooks/useCargaLiviano';
import { fmtLitros, plural } from '../../lib/format';
import { AYUDA_LITROS } from '../../lib/litros';

const fmtKm = (n: number | undefined) =>
  n == null ? '—' : `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })} km`;

/** `mié 18/11 10:32` — corto, para la lista de cargas. */
function cuando(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(',', '');
  return `${dia} ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Cargas de combustible de una camioneta todavía abierta: el resumen
 * («2 cargas · 140 L») y una fila corta por carga. Las que siguen en el equipo
 * dicen que falta sincronizar.
 */
export function CargasTarjeta({ cargas }: { cargas: CargaTarjeta[] | undefined }) {
  if (!cargas?.length) return null;
  const total = cargas.reduce((acc, c) => acc + c.litros, 0);
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-[#f5f6f8] px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-[13.5px] font-semibold">
        <Fuel className="h-4 w-4 text-muted-foreground" aria-hidden />
        {plural(cargas.length, 'carga', 'cargas')} · <span className="tabular">{fmtLitros(total)} L</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {cargas.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted-foreground">
            <span>{cuando(c.fechaIso)}</span>
            <span>·</span>
            <b className="tabular font-semibold text-foreground">{fmtLitros(c.litros)} L</b>
            <span>·</span>
            <span className="tabular">{fmtKm(c.km)}</span>
            {c.adBlueLitros != null && <span className="tabular">· AdBlue {fmtLitros(c.adBlueLitros)} L</span>}
            {c.por && <span>· {c.por}</span>}
            {c.requiereAtencion ? (
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--danger)]">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> no se pudo enviar
              </span>
            ) : (
              c.sinSincronizar && (
                <span className="inline-flex items-center gap-1 font-semibold text-[var(--warning-soft-foreground)]">
                  <Clock className="h-3.5 w-3.5" aria-hidden /> falta sincronizar
                </span>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Formulario de una carga de combustible SIN cerrar la tarjeta de la camioneta
 * (`useCargaLiviano`). Lo comparten Registro de equipo y «Mi camioneta». Foto
 * antes que los litros: el OCR los lee de ella y quedan editables.
 */
export function CargaLivianoForm({ carga }: { carga: UseCargaLivianoResult }) {
  const t = carga.cargando;
  if (!t) return null;
  const { form, setForm, foto } = carga;
  return (
    <Form>
      <div className="flex items-center justify-between rounded-2xl bg-[#f3f4f6] px-3.5 py-3">
        <Label>Kilometraje inicial</Label>
        <b className="tabular text-[17px] font-medium">{fmtKm(t.inicial)}</b>
      </div>

      <FotoRespaldoField
        file={foto.file}
        isReadingPhoto={foto.isReadingPhoto}
        captureDate={foto.captureDate}
        onSelect={foto.handleSelectPhoto}
        onClear={foto.handleClearPhoto}
        requerida
        title="Foto del surtidor"
        subtitle="Debe verse el totalizador. Los litros se leen de la foto y quedan editables."
        staleQuestion="¿Es la carga de esta camioneta?"
      />

      <Campo
        label="Combustible cargado"
        requerido
        unidad="L"
        litros
        hint={AYUDA_LITROS}
        error={carga.litrosError ?? undefined}
        aviso={carga.litrosAviso ?? undefined}
      >
        <Input numerico value={form.litros} onChange={(e) => setForm((f) => ({ ...f, litros: e.target.value }))} />
      </Campo>

      <Campo
        label="Kilometraje al cargar"
        requerido
        unidad="km"
        error={carga.kmError ?? undefined}
        hint={
          carga.kmSugerido != null
            ? `Sugerido: el último registrado (${fmtKm(carga.kmSugerido)}). Corrígelo con lo que marca el tablero.`
            : 'El que marca el tablero al momento de cargar.'
        }
      >
        <Input
          numerico
          value={form.km}
          placeholder={String(t.inicial)}
          onChange={(e) => setForm((f) => ({ ...f, km: e.target.value }))}
        />
      </Campo>

      <AdBlueCampos
        adBlue={form.adBlue}
        litros={form.adBlueLitros}
        resultado={carga.adBlue}
        onAdBlue={(adBlue) => setForm((f) => ({ ...f, adBlue }))}
        onLitros={(adBlueLitros) => setForm((f) => ({ ...f, adBlueLitros }))}
      />

      <Hint>La tarjeta sigue abierta: ciérrala cuando dejes de usar la camioneta.</Hint>

      <Boton ancho onClick={() => void carga.guardar()} disabled={!carga.puedeGuardar}>
        {carga.isGuardando ? 'Guardando…' : 'Registrar carga'} <ArrowRight className="h-[19px] w-[19px]" />
      </Boton>
      {carga.falta && <p className="m-0 text-center text-[12.5px] text-muted-foreground">{carga.falta}</p>}
    </Form>
  );
}
