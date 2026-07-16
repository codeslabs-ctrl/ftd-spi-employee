import { notFound } from '../../shared/errors/http-error';

const SEED: Record<string, unknown>[] = [
  {
    companyId: '1',
    id: '10',
    name: 'Farmacia Central',
    functions: 'Operaciones',
    adminLocation: 'Caracas',
    startDate: '2015-01-01',
    maxPosts: '50',
  },
];

export class InMemoryOrgUnitsRepository {
  private readonly byCountry = new Map<string, Record<string, unknown>[]>();

  private store(country: string): Record<string, unknown>[] {
    if (!this.byCountry.has(country)) {
      this.byCountry.set(
        country,
        SEED.map((c) => ({ ...c })),
      );
    }
    return this.byCountry.get(country)!;
  }

  async findById(country: string, companyId: string, id: string) {
    const item = this.store(country).find(
      (u) => u.companyId === companyId && u.id === id,
    );
    if (!item) throw notFound(`Org unit ${companyId}/${id} not found`);
    return item;
  }

  async findAll(
    country: string,
    page: number,
    size: number,
    companyId?: string,
  ) {
    let items = this.store(country);
    if (companyId !== undefined) {
      items = items.filter((u) => u.companyId === companyId);
    }
    const start = (page - 1) * size;
    return { page, size, items: items.slice(start, start + size) };
  }
}
