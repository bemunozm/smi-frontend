import { useRef, useState, type ChangeEvent } from 'react';
import { uploadImage, assetUrl } from '../api/uploads';

interface Props {
  label: string;
  value?: string;
  onChange: (url: string | undefined) => void;
  wrapClassName?: string;
}

export function ImageUploadField({ label, value, onChange, wrapClassName = '' }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(undefined);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch {
      setError('No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  const clear = () => {
    onChange(undefined);
    if (inputRef.current) inputRef.current.value = '';
  };

  const preview = assetUrl(value);

  return (
    <div className={`flex flex-col gap-1 text-sm ${wrapClassName}`}>
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="block w-full rounded-lg border border-border bg-background text-xs file:mr-3 file:cursor-pointer file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
        />
        {preview && (
          <img
            src={preview}
            alt="Vista previa"
            className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
          />
        )}
      </div>
      {uploading && <span className="text-xs text-muted-foreground">Subiendo…</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
      {value && !uploading && (
        <button type="button" onClick={clear} className="self-start text-xs text-muted-foreground underline">
          Quitar imagen
        </button>
      )}
    </div>
  );
}
