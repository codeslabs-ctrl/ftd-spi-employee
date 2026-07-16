const SEED: Record<string, unknown>[] = [
  { id: '1', name: 'Soltero', legalCode: 'S' },
  { id: '2', name: 'Casado', legalCode: 'C' },
  { id: '3', name: 'Divorciado', legalCode: 'D' },
];

export class InMemoryMaritalStatusesRepository {
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

  async findAll(country: string, page: number, size: number) {
    const items = this.store(country);
    const start = (page - 1) * size;
    return { page, size, items: items.slice(start, start + size) };
  }
}
