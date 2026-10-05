import { TriangleAlert } from 'lucide-react';
import { Button } from '@heroui/react';

/**
 * Lo que se ve cuando la base local no abre (ver `offline/useOfflineDb`): sin ella
 * no hay dónde guardar registros sin señal, y seguir como si nada dejaría la
 * pantalla rota. Dice qué hacer, y que lo ya guardado no se perdió.
 */
export function OfflineDbError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <TriangleAlert aria-hidden className="h-8 w-8 text-warning" />
      <h1 className="m-0 font-display text-2xl font-bold text-foreground">
        No se puede abrir el almacenamiento del equipo
      </h1>
      <p className="m-0 text-sm text-muted-foreground">
        SMI guarda en este equipo lo que registrás sin señal, y ahora no pudo abrirlo. Los registros que ya estaban
        guardados no se borraron.
      </p>
      <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-foreground">
        <li>Cerrá las demás pestañas o ventanas de SMI que tengas abiertas.</li>
        <li>Liberá espacio en el equipo (fotos, descargas, apps que no uses).</li>
        <li>Si usás una ventana privada, abrí SMI en una normal.</li>
      </ol>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" onPress={onRetry}>
          Reintentar
        </Button>
        <Button variant="tertiary" onPress={() => window.location.reload()}>
          Recargar la app
        </Button>
      </div>
      <p className="m-0 text-xs text-muted-foreground">Si sigue fallando, avisá a soporte antes de borrar datos del sitio.</p>
    </div>
  );
}
