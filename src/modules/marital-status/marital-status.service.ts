import { fetchAllPages } from '../../shared/utils/fetch-all-pages.util';
import { InMemoryMaritalStatusesRepository } from './in-memory-marital-status.repository';
import { MaritalStatusesRepository } from './marital-status.repository';

export type MaritalStatusRepo =
  | MaritalStatusesRepository
  | InMemoryMaritalStatusesRepository;

export class MaritalStatusesService {
  constructor(private readonly repo: MaritalStatusRepo) {}

  async findAll(country: string, page: number, size: number, paginate = true) {
    if (!paginate) {
      const items = await fetchAllPages((p, s) =>
        this.repo.findAll(country, p, s),
      );
      return { page: 1, size: items.length, paginate: false, items };
    }
    const result = await this.repo.findAll(country, page, size);
    return { ...result, paginate: true };
  }
}

let singleton: MaritalStatusesService | null = null;

export function createMaritalStatusesService(): MaritalStatusesService {
  if (!singleton) {
    const repo =
      process.env.FAKE_DB === 'true'
        ? new InMemoryMaritalStatusesRepository()
        : new MaritalStatusesRepository();
    singleton = new MaritalStatusesService(repo);
  }
  return singleton;
}
