/**
 * Pone las keys de los archivos ya subidos en el cuerpo de la escritura. El
 * `field` es un campo de primer nivel (`fotoKey`) o una ruta con puntos para
 * los que van anidados (`entries.3.photoKeys.0`: el checklist diario lleva
 * varias fotos por ítem). Nunca modifica el cuerpo guardado en la cola.
 */
export function injectFileKeys<T extends object>(body: T, files: readonly { field: string; tmpKey?: string }[]): T {
  const anidado = files.some((f) => f.field.includes('.'));
  const out = (anidado ? structuredClone(body) : { ...body }) as Record<string, unknown>;
  for (const file of files) {
    const ruta = file.field.split('.');
    let nodo: Record<string, unknown> = out;
    for (let i = 0; i < ruta.length - 1; i++) {
      const siguiente = nodo[ruta[i]];
      if (typeof siguiente === 'object' && siguiente !== null) {
        nodo = siguiente as Record<string, unknown>;
      } else {
        const hijo: Record<string, unknown> | unknown[] = /^\d+$/.test(ruta[i + 1]) ? [] : {};
        nodo[ruta[i]] = hijo;
        nodo = hijo as Record<string, unknown>;
      }
    }
    nodo[ruta[ruta.length - 1]] = file.tmpKey;
  }
  return out as T;
}
