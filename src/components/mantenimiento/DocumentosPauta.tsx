import { useRef, useState } from 'react';
import { Download, FileText, Paperclip, Trash2 } from 'lucide-react';
import { Button, Spinner, toast } from '@heroui/react';

import { env } from '../../config/env';
import { usePermissions } from '../../hooks/usePermissions';
import {
  useCreateEquipmentDocument,
  useDeleteEquipmentDocument,
  useEquipmentDocuments,
} from '../../hooks/useEquipmentDocuments';
import {
  isAcceptedUploadType,
  MAX_UPLOAD_BYTES,
  UPLOAD_SIZE_ERROR_MESSAGE,
  UPLOAD_TYPE_ERROR_MESSAGE,
} from '../../lib/upload-limits';

/** El tipo de documento de Flota que guarda las pautas y manuales del fabricante. */
const TIPO_PAUTA = 'MAINTENANCE_MANUAL' as const;

/**
 * Documentos de la pauta de un equipo: la planilla o el manual del fabricante
 * (cada equipo trae el suyo), para que el mantenedor lo abra o lo descargue si
 * tiene dudas al hacer la mantención.
 *
 * No es un almacenamiento aparte: son documentos del equipo (los de Flota, con
 * archivo en el storage privado) del tipo «Pauta de mantención». Por eso
 * también aparecen en la ficha del equipo, y adjuntarlos y quitarlos sigue los
 * permisos de esos documentos (administrador y supervisor). Abrirlos y
 * descargarlos lo puede hacer cualquiera que vea la pauta.
 */
export function DocumentosPauta({ equipmentId, internalCode }: { equipmentId: string; internalCode: string }) {
  const { data: documentos = [], isLoading } = useEquipmentDocuments(equipmentId);
  const crear = useCreateEquipmentDocument(equipmentId);
  const borrar = useDeleteEquipmentDocument();
  const { can } = usePermissions();
  const puedeAdjuntar = can('equipmentDocument.create');
  const puedeQuitar = can('equipmentDocument.delete');
  const inputRef = useRef<HTMLInputElement>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  const deLaPauta = documentos.filter((d) => d.type === TIPO_PAUTA);

  const adjuntar = (file: File | undefined) => {
    if (!file) return;
    if (!isAcceptedUploadType(file.type)) return toast.danger(UPLOAD_TYPE_ERROR_MESSAGE);
    if (file.size > MAX_UPLOAD_BYTES) return toast.danger(UPLOAD_SIZE_ERROR_MESSAGE);
    crear.mutate({
      input: {
        type: TIPO_PAUTA,
        // El nombre del archivo sin extensión es el título que se ve en la lista.
        title: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
      },
      file,
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Documentos de la pauta</h3>
          <p className="text-xs text-muted-foreground">
            Planilla o manual del fabricante, para resolver dudas al hacer la mantención.
          </p>
        </div>
        {puedeAdjuntar ? (
          <>
            <input
              ref={inputRef}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              aria-label={`Adjuntar documento de pauta a ${internalCode}`}
              className="hidden"
              type="file"
              onChange={(e) => {
                adjuntar(e.target.files?.[0]);
                // Permite volver a elegir el mismo archivo después de un error.
                e.target.value = '';
              }}
            />
            <Button variant="secondary" isPending={crear.isPending} onPress={() => inputRef.current?.click()}>
              {({ isPending }) =>
                isPending ? (
                  <Spinner color="current" size="sm" />
                ) : (
                  <>
                    <Paperclip className="size-4" /> Adjuntar documento
                  </>
                )
              }
            </Button>
          </>
        ) : null}
      </div>

      {isLoading ? (
        <Spinner size="sm" />
      ) : deLaPauta.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
          Todavía no hay documentos de la pauta.
          {puedeAdjuntar ? ' Adjuntá la planilla o el manual del fabricante (PDF o imagen, hasta 8 MB).' : ''}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-border rounded-xl border border-border p-0">
          {deLaPauta.map((d) => {
            // El endpoint firma una URL nueva en cada clic: sirve aunque la
            // ventana lleve horas abierta (mismo criterio que la ficha).
            const href = d.fileUrl ? `${env.apiUrl}/api/equipment/documents/${d.id}/file` : null;
            return (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                <FileText aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-semibold" title={d.title ?? d.fileName ?? undefined}>
                    {d.title || d.fileName || 'Documento'}
                  </p>
                  {d.fileName ? <p className="m-0 truncate text-xs text-muted-foreground">{d.fileName}</p> : null}
                </div>
                {href ? (
                  <a
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-(--accent) hover:bg-surface-secondary"
                    href={href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Download aria-hidden className="size-4" /> Ver / descargar
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">Subiendo…</span>
                )}
                {puedeQuitar ? (
                  <Button
                    isIconOnly
                    aria-label={`Quitar ${d.title || d.fileName || 'documento'}`}
                    isPending={borrando === d.id}
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      setBorrando(d.id);
                      borrar.mutate(d.id, { onSettled: () => setBorrando(null) });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
