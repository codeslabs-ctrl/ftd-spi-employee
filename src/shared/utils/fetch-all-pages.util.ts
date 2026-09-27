/**
 * Soporte para el flag `paginate=false` en los endpoints de listado.
 *
 * En vez de tocar cada paquete Oracle (todos ya paginan del lado de la BD
 * con `OFFSET ... FETCH NEXT ... ROWS ONLY` usando page/size), reutilizamos
 * la MISMA llamada paginada del repositorio en un loop hasta agotar los
 * datos, y concatenamos todo en memoria. Cero cambios en Oracle, mismo
 * contrato { page, size, items } de siempre — solo agrega paginate:false y
 * junta todas las páginas en una sola respuesta.
 *
 * BATCH_SIZE = 100 porque es el tope que ya validan todos los ListXDto
 * (@Max(100) en `size`), así que no pedimos nada que Oracle no reciba ya
 * hoy en una petición paginada normal.
 */
export const FETCH_ALL_BATCH_SIZE = 100;

export interface PagedFetchResult<T> {
  items: T[];
}

export async function fetchAllPages<T>(
  fetchPage: (page: number, size: number) => Promise<PagedFetchResult<T>>,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  // Límite defensivo: 500 páginas * 100 = 50,000 filas. Ningún catálogo o
  // listado de este API se acerca a ese volumen; esto solo evita un loop
  // infinito si algún día un endpoint devolviera siempre `size` items sin
  // señalizar el final (bug en el paquete Oracle).
  const MAX_PAGES = 500;
  for (; page <= MAX_PAGES; page += 1) {
    const { items } = await fetchPage(page, FETCH_ALL_BATCH_SIZE);
    all.push(...items);
    if (items.length < FETCH_ALL_BATCH_SIZE) break;
  }
  return all;
}
