/**
 * Definición única de los catálogos de solo lectura expuestos bajo
 * /ftd-spi-employee/rest/catalogs/<key>/list.
 *
 * Convención: `key`, `procedure` y `jsonKey` en inglés (igual que el resto
 * del contrato del API: employee, position, marital-status...). `label` es
 * solo para logs/documentación y sí va en español.
 *
 * Todos comparten el mismo paquete Oracle (CATALOGS_PKG, por defecto
 * pkg_management_catalogs) — cada `procedure` es un wrapper de
 * PRC_GET_GENERIC_CATALOG dentro de ese paquete (ver
 * db/pkg_management_catalogs_api.sql). Agregar un catálogo nuevo = 1 entrada
 * aquí + su wrapper en el paquete Oracle + su seed en
 * in-memory-catalogs.repository.ts (para pruebas con FAKE_DB).
 *
 * Pendiente (no incluido todavía): "Validar reingreso" — falta la consulta
 * SQL (Jhon). Se agrega como una entrada más en cuanto llegue.
 */
export interface CatalogDefinition {
  /** Segmento de ruta: /catalogs/<key>/list */
  key: string;
  /** Procedimiento del PKG Oracle compartido (contrato I_JSON->O_JSON/O_COD/O_MESSAGE). */
  procedure: string;
  /** Clave del arreglo dentro del JSON de salida, ej. {"countries":[...]}. */
  jsonKey: string;
  /** Nombre legible en español, usado en logs/mensajes de error. */
  label: string;
}

export const CATALOG_DEFINITIONS: CatalogDefinition[] = [
  {
    key: 'municipalities',
    procedure: 'prc_get_municipalities',
    jsonKey: 'municipalities',
    label: 'Municipios',
  },
  {
    key: 'countries',
    procedure: 'prc_get_countries',
    jsonKey: 'countries',
    label: 'Países',
  },
  {
    key: 'parishes',
    procedure: 'prc_get_parishes',
    jsonKey: 'parishes',
    label: 'Parroquias',
  },
  {
    key: 'localities',
    procedure: 'prc_get_localities',
    jsonKey: 'localities',
    label: 'Localidades',
  },
  {
    key: 'cities',
    procedure: 'prc_get_cities',
    jsonKey: 'cities',
    label: 'Ciudades (validación de ciudad)',
  },
  {
    key: 'states',
    procedure: 'prc_get_states',
    jsonKey: 'states',
    label: 'Entidades federales (siglas de estados)',
  },
  {
    key: 'payroll-types',
    procedure: 'prc_get_payroll_types',
    jsonKey: 'payrollTypes',
    label: 'Tipos de nómina',
  },
  {
    key: 'groups',
    procedure: 'prc_get_groups',
    jsonKey: 'groups',
    label: 'Descripción de grupos',
  },
  {
    key: 'branches',
    procedure: 'prc_get_branches',
    jsonKey: 'branches',
    label: 'Sucursales',
  },
  {
    key: 'banks',
    procedure: 'prc_get_banks',
    jsonKey: 'banks',
    label: 'Bancos (validación de banco)',
  },
  {
    key: 'account-types',
    procedure: 'prc_get_account_types',
    jsonKey: 'accountTypes',
    label: 'Tipos de cuenta para depósito',
  },
  {
    key: 'id-types',
    procedure: 'prc_get_id_types',
    jsonKey: 'idTypes',
    label: 'Tipos de identificación',
  },
];

export function findCatalogDefinition(key: string): CatalogDefinition {
  const def = CATALOG_DEFINITIONS.find((d) => d.key === key);
  if (!def) {
    throw new Error(`Catálogo desconocido: ${key}`);
  }
  return def;
}
