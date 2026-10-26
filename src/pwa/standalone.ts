/** `(display-mode: standalone)` cubre Android/desktop; `navigator.standalone`
 * es la señal equivalente (no estándar) que usa Safari/iOS — ninguna de las
 * dos alcanza sola en todos los casos, así que se combinan. */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneMedia || iosStandalone;
}
