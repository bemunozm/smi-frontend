import { useEffect, useState } from 'react';

/**
 * `navigator.onLine` en vivo, con los eventos `online`/`offline`. Fuente
 * única — antes vivía duplicado como un hook privado dentro de
 * `layout/TerrenoLayout.tsx` (`useEnLinea`); se extrajo acá porque
 * `views/RegistroEquipoView.tsx` también lo necesita para deshabilitar el
 * enlace de descarga del PDF del reporte sin señal.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
