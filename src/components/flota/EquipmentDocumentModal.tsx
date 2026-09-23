import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Button, FieldError, Input, Label, ListBox, Modal, Select, Spinner, TextField, toast } from '@heroui/react';

import { assetUrl, uploadImage } from '../../api/UploadsAPI';
import { useCreateEquipmentDocument, useUpdateEquipmentDocument } from '../../hooks/useEquipmentDocuments';
import { EQUIPMENT_DOCUMENT_TYPE_OPTIONS } from '../../config/flota-colors';
import {
  EquipmentDocumentFormSchema,
  toCreateEquipmentDocumentPayload,
  toUpdateEquipmentDocumentPayload,
  type EquipmentDocument,
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
    fileUrl: documento?.fileUrl ?? null,
    notes: documento?.notes ?? '',
  };
}

/** Nombre a mostrar junto al adjunto — el nombre real del `File` recién
 * elegido, o (al editar un documento ya guardado, donde no hay `File` a
 * mano) el último segmento de la URL servida por `/api/uploads`. */
function fileDisplayName(fileName: string | null, url: string | null): string | null {
  if (fileName) return fileName;
  if (!url) return null;
  const segments = url.split('/');
  return segments[segments.length - 1] || 'Archivo adjunto';
}

/**
 * Campo de adjunto simple — mismo criterio de subida inmediata que
 * `EquipoPhotoBanner` (`EquipoEditDelete.tsx`), pero SIN el flujo foto→OCR→
 * EXIF de `FotoRespaldoField`: acá el archivo puede ser un PDF o una imagen
 * (`POST /api/uploads` ya admite ambos, ver `UploadsAPI.ts`), no hay lectura
 * automática de ningún valor a partir de él.
 */
function DocumentFileField({
  fileName,
  value,
  onChange,
  onFileNameChange,
}: {
  fileName: string | null;
  value: string | null;
  onChange: (url: string | null) => void;
  onFileNameChange: (name: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const href = assetUrl(value);
  const nombre = fileDisplayName(fileName, value);

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadImage(file);
      onFileNameChange(file.name);
      onChange(url);
    } catch {
      toast.danger('No se pudo subir el archivo. Intenta de nuevo.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>Archivo adjunto (opcional)</Label>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-separator bg-surface-secondary px-3.5 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {value ? (
            <>
              <span className="truncate text-sm font-medium text-foreground">{nombre}</span>
              {href ? (
                <a
                  className="w-fit text-xs font-semibold text-(--accent) hover:underline"
                  href={href}
                  rel="noreferrer"
                  target="_blank"
                >
                  Ver archivo actual
                </a>
              ) : null}
            </>
          ) : (
            <span className="text-xs text-(--muted)">PDF o imagen · máx. 5MB</span>
          )}
        </div>
        <Button
          isPending={isUploading}
          size="sm"
          type="button"
          variant="secondary"
          onPress={() => inputRef.current?.click()}
        >
          {({ isPending }) =>
            isPending ? <Spinner color="current" size="sm" /> : value ? 'Reemplazar' : 'Adjuntar archivo'
          }
        </Button>
      </div>
      <input
        accept="application/pdf,image/*"
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
  const [fileName, setFileName] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EquipmentDocumentFormValues>({
    resolver: zodResolver(EquipmentDocumentFormSchema),
    // `values` (no `defaultValues`): el modal vive montado siempre, así que
    // el form debe re-sincronizarse cuando cambia el documento a editar.
    values: buildFormValues(document),
  });

  // Reset explícito al abrir — mismo motivo que `EditEquipoModal`: sin esto,
  // cancelar sin guardar y reabrir (para el mismo documento u otro) dejaría
  // campos editados a medias, porque `values` (arriba) solo re-sincroniza
  // cuando `document` cambia de verdad.
  useEffect(() => {
    if (isOpen) {
      reset(buildFormValues(document));
      setFileName(null);
    }
  }, [isOpen, document, reset]);

  const cerrar = () => onOpenChange(false);

  const onSubmit = (values: EquipmentDocumentFormValues): void => {
    if (isEditing && document) {
      updateDocument.mutate(
        { id: document.id, input: toUpdateEquipmentDocumentPayload(values) },
        { onSuccess: cerrar },
      );
    } else {
      createDocument.mutate(toCreateEquipmentDocumentPayload(values), { onSuccess: cerrar });
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

              <Controller
                control={control}
                name="fileUrl"
                render={({ field }) => (
                  <DocumentFileField
                    fileName={fileName}
                    value={field.value}
                    onChange={field.onChange}
                    onFileNameChange={setFileName}
                  />
                )}
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
