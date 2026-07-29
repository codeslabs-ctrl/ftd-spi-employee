import { CatalogFilters } from './catalog.definitions';

/**
 * Datos de prueba (FAKE_DB=true) por catálogo. Son ejemplos genéricos —
 * cuando lleguen los scripts de tabla reales, esto se puede afinar para
 * reflejar columnas exactas, pero no bloquea probar el contrato HTTP hoy.
 */
const SEED: Record<string, Record<string, unknown>[]> = {
  municipalities: [
    { id: '1', nombre: 'Libertador', id_entidad: '11' },
    { id: '2', nombre: 'Chacao', id_entidad: '11' },
  ],
  countries: [
    { id: 'VE', nombre: 'Venezuela' },
    { id: 'CO', nombre: 'Colombia' },
  ],
  parishes: [
    { id: '1', nombre: 'Catedral', id_municipio: '1' },
    { id: '2', nombre: 'San Bernardino', id_municipio: '1' },
  ],
  localities: [
    { id: '1', nombre: 'Caracas' },
    { id: '2', nombre: 'Valencia' },
  ],
  cities: [
    { id: '1', nombre: 'Caracas' },
    { id: '2', nombre: 'Bogotá' },
  ],
  states: [
    { id: '11', sigla: 'DC', nombre: 'Distrito Capital' },
    { id: '13', sigla: 'CAR', nombre: 'Carabobo' },
  ],
  'payroll-types': [
    { id: '1', nombre: 'Quincenal' },
    { id: '2', nombre: 'Mensual' },
  ],
  groups: [
    { id: '1', descripcion: 'Nómina administrativa' },
    { id: '2', descripcion: 'Nómina operativa' },
  ],
  branches: [
    { id: '1', nombre: 'Sucursal Centro' },
    { id: '2', nombre: 'Sucursal Norte' },
  ],
  banks: [
    { id: '1', nombre: 'Banco de Venezuela' },
    { id: '2', nombre: 'Banesco' },
  ],
  'account-types': [
    { id: '1', nombre: 'Cuenta corriente' },
    { id: '2', nombre: 'Cuenta de ahorro' },
  ],
  'id-types': [
    { id: 'V', nombre: 'Cédula de identidad' },
    { id: 'E', nombre: 'Cédula de extranjero' },
  ],
  'termination-reasons': [
    { code: '902', description: 'TERMINACION SIN CAUSA JUSTA' },
    { code: '903', description: 'RENUNCIA POR PARTE DEL TRABAJADOR' },
  ],
  'change-reasons': [
    { code: 'P', description: 'PROMOCION' },
    { code: 'C', description: 'CONTRATO' },
  ],
  'pension-funds': [
    { code: '1', name: 'PROTECCION', institutionTypeCode: 'PE' },
    { code: '2', name: 'COLFONDOS', institutionTypeCode: 'PE' },
  ],
  'health-providers': [
    { code: '1', name: 'SURA EPS', institutionTypeCode: 'SA' },
    { code: '2', name: 'NUEVA EPS', institutionTypeCode: 'SA' },
  ],
  'compensation-funds': [
    { code: '1', name: 'COMPENSAR', institutionTypeCode: 'CA' },
    { code: '2', name: 'COLSUBSIDIO', institutionTypeCode: 'CA' },
  ],
  'severance-funds': [
    { code: '1', name: 'PORVENIR CESANTIAS', institutionTypeCode: 'CE' },
    { code: '2', name: 'PROTECCION CESANTIAS', institutionTypeCode: 'CE' },
  ],
  'contract-types': [
    { companyId: '101', code: '2', name: 'Termino Indefinido' },
    { companyId: '101', code: '4', name: 'Aprendizaje' },
  ],
};

// Cédulas de prueba con "rastro previo" simulado (equivalente a tener una
// fila en TA_RELACION_LABORAL) para probar PRC_VALIDATE_REENTRY con FAKE_DB.
const REENTRY_SEED = new Set(['1010101010', '2020202020']);

export class InMemoryCatalogsRepository {
  /**
   * `filters` se acepta por compatibilidad de firma con CatalogsRepository
   * pero NO se aplica sobre el SEED (datos de ejemplo genéricos, sin los
   * campos reales como companyId) — FAKE_DB solo prueba el contrato HTTP
   * (paginación/forma de la respuesta), no el filtrado de negocio real.
   */
  async findAll(
    _country: string,
    catalogKey: string,
    page: number,
    size: number,
    _filters: CatalogFilters = {},
  ) {
    const items = SEED[catalogKey] ?? [];
    const start = (page - 1) * size;
    return { page, size, items: items.slice(start, start + size) };
  }

  async validateReentry(
    _country: string,
    numIden: string,
    reingreso: 'SI' | 'NO',
  ) {
    const exists = REENTRY_SEED.has(numIden);
    let final: 'SI' | 'NO' = reingreso;
    let corrected = false;

    if (reingreso === 'SI' && !exists) {
      final = 'NO';
      corrected = true;
    } else if (reingreso === 'NO' && exists) {
      final = 'SI';
      corrected = true;
    }

    return {
      numIden,
      declaredReingreso: reingreso,
      reingreso: final,
      corrected,
      value: corrected ? 0 : 1,
    };
  }
}
