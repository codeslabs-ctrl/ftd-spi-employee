/**
 * Transform de class-transformer para flags booleanos opcionales tipo
 * `paginate`. No usamos `@Type(() => Boolean)`: su conversión implícita es
 * `Boolean(value)`, que trata CUALQUIER string no vacío —incluido
 * "false"— como `true`. Esto normaliza explícitamente:
 *   - JSON real (RequestJson descifrado): ya llega como boolean nativo.
 *   - application/x-www-form-urlencoded o querystring: llega como string
 *     "true"/"false".
 *   - Ausente: por defecto `true` (mantiene el comportamiento paginado de
 *     siempre para clientes que no manden el flag).
 *
 * IMPORTANTE: en el `@Transform` de cada DTO hay que leer `obj.paginate`
 * (el objeto plano original), NO `value`. `validateDto` usa
 * `enableImplicitConversion: true`, y class-transformer aplica esa
 * conversión implícita ANTES que este `@Transform` cuando el campo no
 * tiene `@Type()` propio — es decir, para un `size` (`@Type(() => Number)`)
 * value ya viene bien, pero para `paginate` (sin `@Type`) `value` llegaría
 * ya "pre-convertido" con el mismo `Boolean("false") === true` que este
 * helper existe para evitar. Leer de `obj` esquiva esa conversión previa.
 */
export function toBooleanDefaultTrue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() !== 'false';
  return Boolean(value);
}
