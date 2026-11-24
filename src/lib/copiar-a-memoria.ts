/** Copia el contenido de la foto a un `File` en memoria, que ya no depende
 * del permiso sobre el archivo original de la galería: Android puede quitarlo
 * unos minutos después de elegirla (caso real del 15/11/2026: «The requested
 * file could not be read…» al guardar un rato después). */
export async function copiarAMemoria(file: File): Promise<File> {
  const bytes = await file.arrayBuffer();
  return new File([bytes], file.name, { type: file.type, lastModified: file.lastModified });
}
