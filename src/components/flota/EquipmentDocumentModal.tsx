import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Button, FieldError, Input, Label, ListBox, Modal, Select, Spinner, TextField, toast } from '@heroui/react';

import { uploadFile } from '../../api/UploadsAPI';
import { env } from '../../config/env';
import { useCreateEquipmentDocument, useUpdateEquipmentDocument } from '../../hooks/useEquipmentDocuments';
import { EQUIPMENT_DOCUMENT_TYPE_OPTIONS } from '../../config/flota-colors';
import {
  EquipmentDocumentFormSchema,
  toCreateEquipmentDocumentPayload,
  toUpdateEquipmentDocumentPayload,
  type EquipmentDocument,
  type EquipmentDocumentFileChange,
  type EquipmentDocumentFormValues,
  type EquipmentDocumentType,
} from '../../types/equipment-document';
import { RESPONSIVE_SHEET_DIALOG_CLASS } from './modal-styles';

/** Convierte un ISO datetime (`documento.expiryDate`) al formato que espera
 * `<Input type="date">` (`"YYYY-MM-DD"`), o `''` sin fecha cargada — mismo
 * criterio que `toDateInputValue` de `EquipoEditDelete.tsx`. */
function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

function buildFormValues(documento: EquipmentDocument | null): EquipmentDocumentFormValues {
  return {
    type: documento?.type ?? 'TECHNICAL_INSPECTION',
    title: documento?.title ?? '',
    expiryDate: toDateInputValue(documento?.expiryDate ?? null),
    notes: documento?.notes ?? '',
  };
}

/** Tri-state del adjunto, igual criterio que `photoKey` en
 * `EquipoEditDelete.tsx` pero con nombre incluido (los dos siempre viajan
 * juntos — ver `EquipmentDocumentFileChange`): `undefined` = sin cambios (se
 * sigue mostrando el archivo ya guardado), `{key: null, name: null}` = el
 * usuario lo quitó, `{key, name}` = subió uno nuevo. */
type FileState = EquipmentDocumentFileChange | { key: null; name: null } | undefined;

/**
 * Campo de adjunto simple — mismo criterio de subida inmediata y de "dirty
 * key" fuera del form de RHF que `EquipoPhotoBanner` (`EquipoEditDelete.tsx`),
 * pero SIN el flujo foto→OCR→EXIF de `FotoRespaldoField`: acá el archivo
 * puede ser un PDF o una imagen (`POST /api/files` ya admite ambos, ver
 * `UploadsAPI.ts#uploadFile`), no hay lectura automática de ningún valor a
 * partir de él.
 *
 * El nombre a mostrar SIEMPRE sale de `fileName` (propio o del `File` recién
 * elegido) — nunca se parsea de la URL: ahora es una URL firmada con query,
 * no un nombre de archivo legible.
 */
function DocumentFileField({
  savedFileHref,
  savedFileName,
  fileState,
  onFileStateChange,
}: {
  /** Link al archivo ya guardado — el endpoint de redirect 302
   * (`GET /api/equipment/documents/:id/file`, mismo patrón que
   * `EquipoDetalleView.tsx`), NO la URL firmada cruda de la respuesta del
   * listado: firma una URL RECIÉN generada en cada click, así que sirve
   * aunque la pestaña lleve horas abierta (QA menor: la firma del listado
   * podía haber expirado; ver Diseño del RFC R2-storage, "Contrato de la API
   * — Documentos"). `null` si el documento no tiene adjunto. */
  savedFileHref: string | null;
  savedFileName: string | null;
  fileState: FileState;
  onFileStateChange: (state: FileState) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);

  const removed = fileState !== undefined && fileState.key === null;
  const href = fileState !== undefined ? (removed ? null : pendingPreviewUrl) : savedFileHref;
  const nombre = fileState !== undefined ? fileState.name : savedFileName;
  const hasFile = href != null;

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setIsUploading(true);
    try {
      const { key, url } = await uploadFile(file);
      setPendingPreviewUrl(url);
      onFileStateChange({ key, name: file.name });
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'No se pudo subir el archivo. Intenta de nuevo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPendingPreviewUrl(null);
    onFileStateChange({ key: null, name: null });
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>Archivo adjunto (opcional)</Label>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-separator bg-surface-secondary px-3.5 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {hasFile ? (
            <>
              <span className="truncate text-sm font-medium text-foreground">{nombre}</span>
              {href ? (
                <a
                  className="w-fit text-xs font-semibold text-(--accent) hover:underline"
                  href={href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Ver archivo actual
                </a>
              ) : null}
            </>
          ) : (
            <span className="text-xs text-(--muted)">PDF, JPG, PNG o WebP · máx. 8 MB</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasFile ? (
            <Button isDisabled={isUploading} size="sm" type="button" variant="tertiary" onPress={handleRemove}>
              Quitar
            </Button>
          ) : null}
          <Button
            isPending={isUploading}
            size="sm"
            type="button"
            variant="secondary"
            onPress={() => inputRef.current?.click()}
          >
            {({ isPending }) =>
              isPending ? <Spinner color="current" size="sm" /> : hasFile ? 'Reemplazar' : 'Adjuntar archivo'
            }
          </Button>
        </div>
      </div>
      <input
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
        ref={inputRef}
        type="file"
      />
    </div>
  );
}

export interface EquipmentDocumentModalProps {
  equipmentId: string;
  /** `null` = crear un documento nuevo (`POST`); con un documento, el modal
   * precarga sus datos y guarda con `PATCH` en vez de `POST`. */
  document: EquipmentDocument | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/**
 * Modal de crear/editar UN documento del equipo (tipo, título, vencimiento,
 * adjunto y notas) — reemplaza a los 2 campos planos R1/R2 que antes vivían
 * en `CamposEquipo`. Vive montado una sola vez por `EquipoDetalleView`
 * (controlado por `document`/`isOpen`), mismo patrón que
 * `RegistrarCargaCombustibleModal`.
 */
export function EquipmentDocumentModal({ equipmentId, document, isOpen, onOpenChange }: EquipmentDocumentModalProps) {
  const isEditing = !!document;
  const createDocument = useCreateEquipmentDocument(equipmentId);
  const updateDocument = useUpdateEquipmentDocument(equipmentId);
  const isPending = createDocument.isPending || updateDocument.isPending;
  // `fileUrl` (firmada, de la respuesta del listado) solo dice SI hay archivo
  // adjunto — el link real usa el endpoint de redirect 302, mismo criterio
  // que `EquipoDetalleView.tsx` (ver `DocumentFileField`, prop `savedFileHref`).
  const savedFileHref = document?.fileUrl
    ? `${env.apiUrl}/api/equipment/documents/${document.id}/file`
    : null;
  // Tri-state del adjunto — vive FUERA del form de RHF (ver `DocumentFileField`
  // y `FileState`): `undefined` = sin cambios, `{key: null, name: null}` =
  // se quitó, `{key, name}` = archivo nuevo. `fileResetKey` fuerza el
  // remount de `DocumentFileField` al reabrir el modal (mismo patrón que
  // `photoResetKey` en `EquipoEditDelete.tsx`).
  const [fileState, setFileState] = useState<EquipmentDocumentFileChange | { key: null; name: null } | undefined>(
    undefined,
  );
  const [fileResetKey, setFileResetKey] = useState(0);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EquipmentDocumentFormValues>({
    resolver: zodResolver(EquipmentDocumentFormSchema),
    // `values` (no `defaultValues`): el modal vive montado siempre, así que
    // el form debe re-sincronizarse cuando cambia el documento a editar — o
    // cuando un refetch de `['equipment']` (otro dominio invalidando esa key,
    // p. ej. `useCombustible`/`useHorometro`) trae el MISMO documento con una
    // referencia nueva. `keepDirtyValues` evita que ese re-sync en segundo
    // plano pise texto que el usuario ya escribió y no ha guardado (review
    // QA: mismo bug de refetch que `EditEquipoModal`).
    values: buildFormValues(document),
    resetOptions: { keepDirtyValues: true },
  });

  // Reset imperativo SOLO en la transición false→true (abrir el modal de
  // verdad) — mismo criterio que `EditEquipoModal`. Antes corría con
  // CUALQUIER cambio de referencia de `document` mientras el modal seguía
  // abierto (el refetch de arriba), lo que pisaba en silencio un archivo
  // recién subido (`fileState`, tri-state fuera del form de RHF —
  // `keepDirtyValues` no lo protege) y su preview (review QA). El re-sync de
  // los CAMPOS del form mientras el modal sigue abierto ahora lo cubre
  // `keepDirtyValues` de arriba; acá solo queda "abrir de verdad", que sigue
  // necesitando el `reset` imperativo: sin él, cancelar sin guardar y reabrir
  // (para el mismo documento u otro) dejaría campos editados a medias, porque
  // `values` solo re-sincroniza cuando `document` cambia de verdad.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      // `keepDirtyValues: false` explícito — mismo motivo que
      // `EditEquipoModal`: `reset()` mezcla el `resetOptions` del `useForm`
      // (arriba, `keepDirtyValues: true`) como DEFAULT de cualquier llamada,
      // así que sin este override este reset "de apertura" NO limpiaría los
      // campos editados y cancelados.
      reset(buildFormValues(document), { keepDirtyValues: false });
      setFileState(undefined);
      setFileResetKey((n) => n + 1);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, document, reset]);

  const cerrar = () => onOpenChange(false);

  const onSubmit = (values: EquipmentDocumentFormValues): void => {
    if (isEditing && document) {
      updateDocument.mutate(
        { id: document.id, input: toUpdateEquipmentDocumentPayload(values, fileState) },
        { onSuccess: cerrar },
      );
    } else {
      const file = fileState && fileState.key !== null ? { key: fileState.key, name: fileState.name } : undefined;
      createDocument.mutate(toCreateEquipmentDocumentPayload(values, file), { onSuccess: cerrar });
    }
  };

  return (
    <Modal.Backdrop
      isDismissable={!isPending}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) cerrar();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={RESPONSIVE_SHEET_DIALOG_CLASS}>
          <Modal.CloseTrigger isDisabled={isPending} />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              {isEditing ? 'Editar documento' : 'Agregar documento'}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form
              className="flex flex-col gap-4"
              id="equipment-document-form"
              noValidate
              onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            >
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select
                    fullWidth
                    isInvalid={!!errors.type}
                    name={field.name}
                    value={field.value}
                    onChange={(value) => {
                      if (value) field.onChange(value as EquipmentDocumentType);
                    }}
                  >
                    <Label>Tipo de documento</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {EQUIPMENT_DOCUMENT_TYPE_OPTIONS.map((option) => (
                          <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                            {option.label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                    {errors.type ? <FieldError>{errors.type.message}</FieldError> : null}
                  </Select>
                )}
              />

              <Controller
                control={control}
                name="title"
                render={({ field }) => (
                  <TextField
                    fullWidth
                    isInvalid={!!errors.title}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    value={field.value}
                  >
                    <Label>Título (opcional)</Label>
                    <Input placeholder="Ej. Certificado ISO 9001" />
                    {errors.title ? <FieldError>{errors.title.message}</FieldError> : null}
                  </TextField>
                )}
              />

              <Controller
                control={control}
                name="expiryDate"
                render={({ field }) => (
                  <TextField
                    fullWidth
                    isInvalid={!!errors.expiryDate}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    type="date"
                    value={field.value}
                  >
                    <Label>Vencimiento (opcional)</Label>
                    <Input />
                    {errors.expiryDate ? <FieldError>{errors.expiryDate.message}</FieldError> : null}
                  </TextField>
                )}
              />

              <DocumentFileField
                fileState={fileState}
                key={fileResetKey}
                onFileStateChange={setFileState}
                savedFileHref={savedFileHref}
                savedFileName={document?.fileName ?? null}
              />

              <Controller
                control={control}
                name="notes"
                render={({ field }) => (
                  <TextField
                    fullWidth
                    isInvalid={!!errors.notes}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    value={field.value}
                  >
                    <Label>Notas (opcional)</Label>
                    <Input placeholder="Notas adicionales" />
                    {errors.notes ? <FieldError>{errors.notes.message}</FieldError> : null}
                  </TextField>
                )}
              />
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button isDisabled={isPending} onPress={cerrar} variant="secondary">
              Cancelar
            </Button>
            <Button form="equipment-document-form" isPending={isPending} type="submit">
              {({ isPending: submitting }) => (submitting ? <Spinner color="current" size="sm" /> : 'Guardar')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
