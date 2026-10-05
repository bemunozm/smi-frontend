import { AlertTriangle, Camera, Clock } from 'lucide-react';

/**
 * Marca de un registro que vive solo en el outbox (todavía no confirmado por
 * el servidor), para el historial de Hallazgos y Trabajos extra — el mismo
 * aviso ámbar que `RegistroEquipoView` pone en sus tarjetas pendientes.
 * `requiereAtencion` cambia el texto: el servidor lo rechazó y espera una
 * acción en la hoja de sincronización, no solo señal. `edicion` es la variante
 * de un registro ya enviado con un cambio guardado que todavía no llegó.
 */
export function MarcaSinSincronizar({
  requiereAtencion = false,
  fotoPendiente = false,
  edicion = false,
}: {
  requiereAtencion?: boolean;
  fotoPendiente?: boolean;
  /** El registro SÍ está en el servidor: lo que espera es una edición. */
  edicion?: boolean;
}) {
  const Icono = requiereAtencion ? AlertTriangle : Clock;
  return (
    <div className="mt-0.5 flex flex-col gap-0.5 text-[12.5px] font-semibold text-[var(--warning-soft-foreground)]">
      <span className="flex items-center gap-1.5">
        <Icono className="h-[15px] w-[15px]" />
        {requiereAtencion
          ? 'Requiere atención · ver Sincronización'
          : edicion
            ? 'Edición sin sincronizar'
            : 'Sin sincronizar'}
      </span>
      {fotoPendiente && (
        <span className="flex items-center gap-1.5">
          <Camera className="h-[15px] w-[15px]" />
          Foto pendiente de subir
        </span>
      )}
    </div>
  );
}
