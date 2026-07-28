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
};

export class InMemoryCatalogsRepository {
  async findAll(
    _country: string,
    catalogKey: string,
    page: number,
    size: number,
  ) {
    const items = SEED[catalogKey] ?? [];
    const start = (page - 1) * size;
    return { page, size, items: items.slice(start, start + size) };
  }
}
