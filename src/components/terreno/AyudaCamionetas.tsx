import { useRef } from 'react';
import { Dialog, Heading, Popover } from 'react-aria-components';
import { CircleHelp, Info, X } from 'lucide-react';

/**
 * «?» junto al título «Abrir camioneta» con su recuadro de información
 * anclado: cómo se registran las camionetas. Lo controla la vista (se abre
 * solo al entrar a Livianos); se cierra con la X o tocando fuera, sin fondo
 * oscuro ni bloquear la pantalla. Antes era un recuadro fijo que empujaba el
 * formulario hacia abajo.
 */
export function AyudaCamionetas({
  abierto,
  onAbiertoChange,
}: {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
}) {
  const ancla = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ancla}
        type="button"
        onClick={() => onAbiertoChange(true)}
        aria-label="Cómo funcionan las camionetas"
        aria-expanded={abierto}
        title="Cómo funcionan las camionetas"
        className="-my-2.5 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <CircleHelp className="h-[22px] w-[22px]" aria-hidden />
      </button>
      <Popover
        triggerRef={ancla}
        isOpen={abierto}
        onOpenChange={onAbiertoChange}
        placement="bottom start"
        offset={4}
        containerPadding={16}
        className="w-[min(320px,calc(100vw-32px))] rounded-2xl border border-[var(--accent-soft-foreground)]/20 bg-[var(--accent-soft)] text-[var(--accent-soft-foreground)] shadow-[0_12px_32px_rgba(20,23,28,.14)]"
      >
        <Dialog className="flex flex-col gap-2 px-3.5 py-3 outline-none">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
            <Heading slot="title" className="m-0 flex-1 text-[14.5px] leading-snug font-bold">
              Cómo funcionan las camionetas
            </Heading>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => onAbiertoChange(false)}
              className="-mt-2 -mr-2 inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl hover:bg-black/5"
            >
              <X className="h-[18px] w-[18px]" aria-hidden />
            </button>
          </div>
          <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-[13px] leading-snug text-foreground">
            <li>
              Si la camioneta que vas a usar <b>ya tiene una tarjeta abierta</b> (aparece en «Camionetas abiertas»), no
              abras otra: sigue sirviendo.
            </li>
            <li>
              Cuando le eches combustible, regístralo con <b>«Cargar combustible»</b> (foto del surtidor, litros y km).
              La tarjeta sigue abierta y puedes cargar las veces que haga falta.
            </li>
            <li>
              Ciérrala con <b>«Cerrar tarjeta»</b> cuando la dejes de usar, con el km final. Si ya registraste cargas, la
              carga al cerrar es opcional; si no hubo ninguna, se pide la carga o el motivo (por ejemplo, un corte de
              luz).
            </li>
            <li>Cualquier supervisor puede cargarla o cerrarla, aunque la haya abierto otro.</li>
            <li>Las camionetas no van en el reporte de salida a la administración.</li>
          </ol>
        </Dialog>
      </Popover>
    </>
  );
}
