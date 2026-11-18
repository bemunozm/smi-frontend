import { useEffect, useRef } from 'react';
import { Dialog, Heading, OverlayArrow, Popover } from 'react-aria-components';
import { CircleHelp, Info, X } from 'lucide-react';

/** Cierres por scroll que se ignoran justo después de abrir (reacomodo de la pantalla). */
const VENTANA_REACOMODO_MS = 300;

/**
 * «?» del encabezado de «Abrir camioneta» con su recuadro de información: cómo
 * se registran las camionetas. Lo controla la vista (se abre solo al entrar a
 * Livianos). Es NO modal: no pone una capa encima ni bloquea el scroll, así el
 * primer toque fuera llega a lo que se tocó y además lo cierra; también se
 * cierra con la X y con Escape. El globo nace del ícono: alineado a su derecha
 * y con una flecha que lo apunta.
 */
export function AyudaCamionetas({
  abierto,
  onAbiertoChange,
}: {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
}) {
  const ancla = useRef<HTMLButtonElement>(null);
  const globo = useRef<HTMLElement>(null);
  /** Cuándo se abrió: react-aria cierra un globo no modal al hacer scroll, y al
   * entrar a Livianos la pantalla puede reacomodarse (scroll) justo después. */
  const abiertoDesde = useRef(0);

  // Sin capa modal, cerrar al tocar fuera y con Escape corre por cuenta propia.
  useEffect(() => {
    if (!abierto) return;
    abiertoDesde.current = Date.now();
    const alTocar = (e: PointerEvent) => {
      const objetivo = e.target as Node | null;
      if (objetivo && (globo.current?.contains(objetivo) || ancla.current?.contains(objetivo))) return;
      onAbiertoChange(false);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onAbiertoChange(false);
    };
    // En captura: el `usePress` de react-aria detiene el pointerdown en burbuja, y
    // tocar un control suyo (el selector de camioneta) no cerraba el globo.
    document.addEventListener('pointerdown', alTocar, true);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('pointerdown', alTocar, true);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto, onAbiertoChange]);

  return (
    <>
      <button
        ref={ancla}
        type="button"
        onClick={() => onAbiertoChange(!abierto)}
        aria-label="Cómo funcionan las camionetas"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        title="Cómo funcionan las camionetas"
        className="-my-2.5 -mr-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <CircleHelp className="h-[22px] w-[22px]" aria-hidden />
      </button>
      <Popover
        ref={globo}
        isNonModal
        triggerRef={ancla}
        isOpen={abierto}
        // Lo único que cierra por acá es el scroll de react-aria: se ignora el del reacomodo inicial.
        onOpenChange={(abrir) => {
          if (!abrir && Date.now() - abiertoDesde.current < VENTANA_REACOMODO_MS) return;
          onAbiertoChange(abrir);
        }}
        placement="bottom end"
        offset={10}
        containerPadding={16}
        // Entra desde el ícono (fade + scale); sin animación si el equipo pide menos movimiento.
        className="w-[min(320px,calc(100vw-32px))] origin-(--trigger-anchor-point) rounded-2xl data-[placement=bottom]:rounded-tr-md data-[placement=top]:rounded-br-md border border-[color-mix(in_srgb,var(--accent-soft-foreground)_22%,transparent)] bg-[var(--accent-soft)] text-[var(--accent-soft-foreground)] shadow-[0_12px_32px_rgba(20,23,28,.14)] transition-[opacity,scale] duration-150 ease-out data-[entering]:scale-95 data-[entering]:opacity-0 data-[exiting]:scale-95 data-[exiting]:opacity-0 motion-reduce:transition-none"
      >
        <OverlayArrow className="group block">
          {/* Mismo fondo y borde que el globo; la base queda tapada por el globo. Si el globo se
              invierte hacia arriba (no cabe abajo), la flecha se da vuelta y apunta hacia abajo. */}
          <svg
            width={16}
            height={9}
            viewBox="0 0 16 9"
            className="block group-data-[placement=bottom]:translate-y-px group-data-[placement=top]:-translate-y-px group-data-[placement=top]:rotate-180"
            aria-hidden
          >
            <path
              d="M0 9 L8 1 L16 9"
              className="fill-[var(--accent-soft)] stroke-[color-mix(in_srgb,var(--accent-soft-foreground)_22%,transparent)]"
              strokeWidth={1}
            />
          </svg>
        </OverlayArrow>
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
              Si la camioneta que vas a usar <b>ya tiene una tarjeta abierta</b> (aparece en «Camionetas
              abiertas»), no abras otra: sigue sirviendo.
            </li>
            <li>
              Cuando le eches combustible, regístralo con <b>«Cargar combustible»</b> (foto del surtidor, litros y
              km). La tarjeta sigue abierta y puedes cargar las veces que haga falta.
            </li>
            <li>
              Ciérrala con <b>«Cerrar tarjeta»</b> cuando la dejes de usar, con el km final. Si ya registraste
              cargas, la carga al cerrar es opcional; si no hubo ninguna, se pide la carga o el motivo (por ejemplo,
              un corte de luz).
            </li>
            <li>Cualquier supervisor puede cargarla o cerrarla, aunque la haya abierto otro.</li>
            <li>Las camionetas no van en el reporte de salida a la administración.</li>
          </ol>
        </Dialog>
      </Popover>
    </>
  );
}
