import { notFound } from '../../shared/errors/http-error';

const SEED: Record<string, unknown>[] = [
  {
    companyId: '1',
    unitId: '10',
    id: '100',
    name: 'Farmacéutico',
    positionId: '5',
    description: 'Atención al público',
    startDate: '2020-01-01',
    risk: 'Bajo',
  },
];

export class InMemoryJobPostsRepository {
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

  async findById(
    country: string,
    companyId: string,
    unitId: string,
    id: string,
  ) {
    const item = this.store(country).find(
      (j) =>
        j.companyId === companyId && j.unitId === unitId && j.id === id,
    );
    if (!item) {
      throw notFound(`Job post ${companyId}/${unitId}/${id} not found`);
    }
    return item;
  }

  async findAll(
    country: string,
    page: number,
    size: number,
    companyId?: string,
    unitId?: string,
    positionId?: string,
  ) {
    let items = this.store(country);
    if (companyId !== undefined) {
      items = items.filter((j) => j.companyId === companyId);
    }
    if (unitId !== undefined) {
      items = items.filter((j) => j.unitId === unitId);
    }
    if (positionId !== undefined) {
      items = items.filter((j) => j.positionId === positionId);
    }
    const start = (page - 1) * size;
    return { page, size, items: items.slice(start, start + size) };
  }
}
