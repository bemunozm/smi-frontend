import { z } from 'zod';

// Helpers para inputs numéricos nativos registrados con { valueAsNumber: true }:
// un campo vacío llega como NaN → lo tratamos como undefined.
const nanToUndef = (v: unknown) => (typeof v === 'number' && Number.isNaN(v) ? undefined : v);

export const posNumber = (msg = 'Debe ser mayor a 0') =>
  z.preprocess(nanToUndef, z.number({ error: 'Requerido' }).positive(msg));

export const nonNegNumber = (msg = 'Valor inválido') =>
  z.preprocess(nanToUndef, z.number({ error: 'Requerido' }).nonnegative(msg));

export const optNumber = z.preprocess(nanToUndef, z.number().optional());
