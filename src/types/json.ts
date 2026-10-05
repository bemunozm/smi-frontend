/** JSON puro: lo único que una escritura encolada guarda en su `params`/`body`. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue | undefined };
export type JsonObject = { [key: string]: JsonValue | undefined };
