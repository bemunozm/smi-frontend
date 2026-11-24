/**
 * Simula el ancho de pantalla en los tests de vistas que eligen entre tabla y
 * tarjetas con `useMediaQuery`: `true` = escritorio (toda media query calza),
 * `false` = celular. Se llama en el test o en un `beforeEach`.
 */
export function setViewport(desktop: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: desktop,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
