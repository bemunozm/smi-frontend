import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isFresh, formatRelative, readCaptureDate, recognizeReading } from './photo-reading';

const parseMock = vi.fn();
const recognizeMock = vi.fn();

vi.mock('exifr', () => ({
  default: { parse: (...args: unknown[]) => parseMock(...args) },
}));

vi.mock('tesseract.js', () => ({
  default: { recognize: (...args: unknown[]) => recognizeMock(...args) },
}));

const FILE = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });

afterEach(() => {
  vi.clearAllMocks();
});

describe('isFresh', () => {
  it('es true para una fecha de hace unos minutos', () => {
    expect(isFresh(new Date(Date.now() - 5 * 60_000))).toBe(true);
  });

  it('es false para una fecha de hace más de 24h (umbral por defecto)', () => {
    expect(isFresh(new Date(Date.now() - 30 * 60 * 60 * 1000))).toBe(false);
  });

  it('respeta un umbral custom', () => {
    const haceDosHoras = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(isFresh(haceDosHoras, 1)).toBe(false);
    expect(isFresh(haceDosHoras, 3)).toBe(true);
  });

  it('tolera un pequeño desfase "futuro" (desfase de zona horaria de EXIF, no reloj mal puesto)', () => {
    expect(isFresh(new Date(Date.now() + 60 * 60 * 1000))).toBe(true);
  });

  it('una fecha claramente futura (más allá de la tolerancia) no cuenta como fresca', () => {
    expect(isFresh(new Date(Date.now() + 6 * 60 * 60 * 1000))).toBe(false);
  });
});

describe('formatRelative', () => {
  it('"recién" para hace pocos segundos', () => {
    expect(formatRelative(new Date(Date.now() - 5_000))).toBe('recién');
  });

  it('en minutos', () => {
    expect(formatRelative(new Date(Date.now() - 5 * 60_000))).toBe('hace 5 min');
  });

  it('en horas', () => {
    expect(formatRelative(new Date(Date.now() - 3 * 60 * 60 * 1000))).toBe('hace 3 h');
  });

  it('en días (singular y plural)', () => {
    expect(formatRelative(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000))).toBe('hace 1 día');
    expect(formatRelative(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))).toBe('hace 3 días');
  });

  it('un pequeño desfase "futuro" se lee como "recién", no como alarma', () => {
    expect(formatRelative(new Date(Date.now() + 60 * 60 * 1000))).toBe('recién');
  });

  it('marca "con fecha futura" solo más allá de la tolerancia de zona horaria', () => {
    expect(formatRelative(new Date(Date.now() + 6 * 60 * 60 * 1000))).toBe('con fecha futura');
  });
});

describe('readCaptureDate', () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it('devuelve la fecha cuando exifr trae DateTimeOriginal', async () => {
    const fecha = new Date('2026-08-01T10:00:00.000Z');
    parseMock.mockResolvedValue({ DateTimeOriginal: fecha });
    await expect(readCaptureDate(FILE)).resolves.toEqual(fecha);
    expect(parseMock).toHaveBeenCalledWith(FILE, ['DateTimeOriginal']);
  });

  it('devuelve null si la foto no trae EXIF', async () => {
    parseMock.mockResolvedValue(undefined);
    await expect(readCaptureDate(FILE)).resolves.toBeNull();
  });

  it('devuelve null (no lanza) si exifr falla', async () => {
    parseMock.mockRejectedValue(new Error('archivo inválido'));
    await expect(readCaptureDate(FILE)).resolves.toBeNull();
  });
});

describe('recognizeReading', () => {
  beforeEach(() => {
    recognizeMock.mockReset();
  });

  it('extrae el número más largo del texto reconocido como la lectura', async () => {
    recognizeMock.mockResolvedValue({ data: { text: 'ODO km 12345 h 42', confidence: 87.4 } });
    await expect(recognizeReading(FILE)).resolves.toEqual({ value: '12345', confidence: 87 });
  });

  it('preserva el separador decimal en vez de multiplicar la lectura por 10', async () => {
    recognizeMock.mockResolvedValue({ data: { text: 'Horómetro 1234.5 h', confidence: 90 } });
    await expect(recognizeReading(FILE)).resolves.toEqual({ value: '1234.5', confidence: 90 });
  });

  it('interpreta la coma como separador de miles cuando no va al final con 1-2 dígitos', async () => {
    recognizeMock.mockResolvedValue({ data: { text: 'Odómetro 1,234 km', confidence: 85 } });
    await expect(recognizeReading(FILE)).resolves.toEqual({ value: '1234', confidence: 85 });
  });

  it('interpreta la coma como decimal cuando va al final con 1-2 dígitos (formato litros)', async () => {
    recognizeMock.mockResolvedValue({ data: { text: '80,5 L', confidence: 92 } });
    await expect(recognizeReading(FILE)).resolves.toEqual({ value: '80.5', confidence: 92 });
  });

  it('formato europeo miles+decimal ("1.234,50") conserva ambos separadores correctamente', async () => {
    recognizeMock.mockResolvedValue({ data: { text: '1.234,50', confidence: 88 } });
    await expect(recognizeReading(FILE)).resolves.toEqual({ value: '1234.50', confidence: 88 });
  });

  it('sin números en el texto reconocido, no sugiere ningún valor (aunque haya confianza general)', async () => {
    recognizeMock.mockResolvedValue({ data: { text: 'sin datos legibles', confidence: 40 } });
    await expect(recognizeReading(FILE)).resolves.toEqual({ value: '', confidence: 40 });
  });

  it('si tesseract falla, no rompe: resuelve sin sugerencia', async () => {
    recognizeMock.mockRejectedValue(new Error('el motor OCR no cargó'));
    await expect(recognizeReading(FILE)).resolves.toEqual({ value: '', confidence: 0 });
  });
});
