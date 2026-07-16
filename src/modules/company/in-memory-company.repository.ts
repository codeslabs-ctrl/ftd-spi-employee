import { notFound } from '../../shared/errors/http-error';

const SEED: Record<string, unknown>[] = [
  {
    id: '1',
    name: 'Farmatodo VE',
    shortName: 'FTD-VE',
    sector: 'Retail',
    isPublic: 'N',
    taxId1: 'J-123',
    email: 've@farmatodo.com',
  },
  {
    id: '2',
    name: 'Farmatodo CO',
    shortName: 'FTD-CO',
    sector: 'Retail',
    isPublic: 'N',
    taxId1: '900',
    email: 'co@farmatodo.com',
  },
];

export class InMemoryCompaniesRepository {
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

  async findById(country: string, id: string) {
    const item = this.store(country).find((c) => c.id === id);
    if (!item) throw notFound(`Company ${id} not found`);
    return item;
  }

  async findAll(country: string, page: number, size: number) {
    const items = this.store(country);
    const start = (page - 1) * size;
    return { page, size, items: items.slice(start, start + size) };
  }
}
