import { describe, expect, it } from 'vitest';

import { disponibilidad } from './disponibilidad';

describe('disponibilidad', () => {
  it('es "en-bodega" cuando hay saldo acá', () => {
    expect(disponibilidad(4, 6)).toBe('en-bodega');
  });

  it('es "en-otra" cuando no hay acá pero la empresa tiene', () => {
    // La acción correcta es pedir un traslado, no emitir una orden de compra.
    expect(disponibilidad(0, 6)).toBe('en-otra');
  });

  it('es "sin-stock" cuando no hay en ninguna bodega', () => {
    expect(disponibilidad(0, 0)).toBe('sin-stock');
  });

  it('sigue "en-bodega" con poco saldo: tener poco no es no tener', () => {
    // Queda 1 y puede estar bajo el mínimo de la bodega, pero se puede montar
    // hoy. La reposición es otra alerta y viaja aparte en `bajoMinimo`.
    expect(disponibilidad(1, 1)).toBe('en-bodega');
  });

  it('nunca dice "en-bodega" con saldo 0', () => {
    // Es la regresión que motivó separar esta lectura del mínimo: una bodega
    // sin umbral propio no alerta, y eso no la vuelve surtida.
    expect(disponibilidad(0, 5)).toBe('en-otra');
    expect(disponibilidad(0, 0)).toBe('sin-stock');
  });
});
