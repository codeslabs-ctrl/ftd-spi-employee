/**
 * Definición única de los catálogos de solo lectura expuestos bajo
 * /ftd-spi-employee/rest/catalogs/<key>/list.
 *
 * Convención: `key`, `procedure` y `jsonKey` en inglés (igual que el resto
 * del contrato del API: employee, position, marital-status...). `label` es
 * solo para logs/documentación y sí va en español.
 *
 * Todos comparten el mismo paquete Oracle (CATALOGS_PKG, por defecto
 * pkg_management_catalogs) — cada `procedure` es un SELECT estático propio
 * dentro de ese paquete (ver db/pkg_management_catalogs_api.sql; el motor
 * genérico PRC_GET_GENERIC_CATALOG ya no existe, se eliminó al migrar los
 * 12 catálogos originales). Agregar un catálogo nuevo = 1 entrada aquí + su
 * PRC_GET_* en el paquete Oracle + su seed en
 * in-memory-catalogs.repository.ts (para pruebas con FAKE_DB).
 *
 * 20 catálogos en este arreglo: los 12 originales + 7 agregados 2026-07-29
 * (termination-reasons, change-reasons, pension-funds, health-providers,
 * compensation-funds, severance-funds — estos 4 solo Colombia — y
 * contract-types, EO_CONTRATO_TRABAJO) + relacion-pago agregado 2026-09-27
 * (INFOCENT.NM_RELACION_PAGO, pedido PeopleOne — sin columna de
 * descripción, a diferencia de los demás).
 *
 * "Validar reingreso" (a partir de la cédula) NO está en este arreglo: a
 * diferencia de los demás, no es una lista paginada — es un solo endpoint
 * dedicado, POST /catalogs/validate-reentry (ver PRC_VALIDATE_REENTRY en
 * db/pkg_management_catalogs_api.sql y catalogs.route.ts).
 */
/**
 * Filtros opcionales compartidos entre los 18 catálogos de "list" — no
 * todos los catálogos usan todos estos campos, cada PRC_PARSE_*_FILTER en
 * Oracle solo lee las rutas JSON que le interesan e ignora el resto.
 */
export interface CatalogFilters {
  companyId?: string;
  countryCode?: string;
  stateCode?: string;
  municipalityId?: string;
  payrollTypeCode?: string;
}

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
  {
    key: 'termination-reasons',
    procedure: 'prc_get_termination_reasons',
    jsonKey: 'terminationReasons',
    label: 'Causales de retiro/terminación',
  },
  {
    key: 'change-reasons',
    procedure: 'prc_get_change_reasons',
    jsonKey: 'changeReasons',
    label: 'Motivos de cambio/movimiento',
  },
  {
    key: 'pension-funds',
    procedure: 'prc_get_pension_funds',
    jsonKey: 'pensionFunds',
    label: 'Fondos de pensión (AFP) — solo Colombia',
  },
  {
    key: 'health-providers',
    procedure: 'prc_get_health_providers',
    jsonKey: 'healthProviders',
    label: 'Entidades promotoras de salud (EPS) — solo Colombia',
  },
  {
    key: 'compensation-funds',
    procedure: 'prc_get_compensation_funds',
    jsonKey: 'compensationFunds',
    label: 'Cajas de compensación — solo Colombia',
  },
  {
    key: 'severance-funds',
    procedure: 'prc_get_severance_funds',
    jsonKey: 'severanceFunds',
    label: 'Fondos de cesantías — solo Colombia',
  },
  {
    key: 'contract-types',
    procedure: 'prc_get_contract_types',
    jsonKey: 'contractTypes',
    label: 'Tipos de contrato de trabajo ("Contrato")',
  },
  {
    key: 'relacion-pago',
    procedure: 'prc_get_relacion_pago',
    jsonKey: 'paymentRelations',
    label:
      'Relación pago (envía a nómina) — INFOCENT.NM_RELACION_PAGO, sin columna de descripción',
  },
];

export function findCatalogDefinition(key: string): CatalogDefinition {
  const def = CATALOG_DEFINITIONS.find((d) => d.key === key);
  if (!def) {
    throw new Error(`Catálogo desconocido: ${key}`);
  }
  return def;
}
