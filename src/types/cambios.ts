/**
 * Trazabilidad de cambios a un registro ya enviado (Acta N.° 004, R13): quién
 * cambió qué dato, de qué valor a cuál y cuándo. Misma forma que devuelve el
 * backend (`ChangeLog`), con los valores ya legibles.
 */
export interface CambioCampo {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface EntradaCambios {
  id: string;
  userName: string;
  /** ISO. */
  createdAt: string;
  changes: CambioCampo[];
}
