// Polyfills mínimos para renderizar componentes React-Aria (HeroUI) en jsdom.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// `Dropdown.Menu`/`ListBox` (React Aria) usan `CSS.escape` para enfocar un
// ítem por su `data-key` — jsdom no lo implementa. Polyfill estándar (spec
// CSSOM, mismo algoritmo que el de Mathias Bynens) para que los tests que
// interactúan con un menú/listbox real no revienten con
// "Cannot read properties of undefined (reading 'escape')".
if (typeof CSS === 'undefined' || typeof CSS.escape !== 'function') {
  const cssEscape = (value: string): string => {
    const string = String(value);
    const length = string.length;
    const firstCodeUnit = string.charCodeAt(0);
    let result = '';
    let index = -1;

    if (length === 1 && firstCodeUnit === 0x002d) {
      return `\\${string}`;
    }

    while (++index < length) {
      const codeUnit = string.charCodeAt(index);
      if (codeUnit === 0x0000) {
        result += '�';
        continue;
      }
      if (
        (codeUnit >= 0x0001 && codeUnit <= 0x001f) ||
        codeUnit === 0x007f ||
        (index === 0 && codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
        (index === 1 && codeUnit >= 0x0030 && codeUnit <= 0x0039 && firstCodeUnit === 0x002d)
      ) {
        result += `\\${codeUnit.toString(16)} `;
        continue;
      }
      if (
        codeUnit >= 0x0080 ||
        codeUnit === 0x002d ||
        codeUnit === 0x005f ||
        (codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
        (codeUnit >= 0x0041 && codeUnit <= 0x005a) ||
        (codeUnit >= 0x0061 && codeUnit <= 0x007a)
      ) {
        result += string.charAt(index);
        continue;
      }
      result += `\\${string.charAt(index)}`;
    }
    return result;
  };

  globalThis.CSS = { ...(globalThis.CSS ?? {}), escape: cssEscape } as typeof CSS;
}
