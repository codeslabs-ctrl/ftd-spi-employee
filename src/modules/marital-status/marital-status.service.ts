import { InMemoryMaritalStatusesRepository } from './in-memory-marital-status.repository';
import { MaritalStatusesRepository } from './marital-status.repository';

export type MaritalStatusRepo =
  | MaritalStatusesRepository
  | InMemoryMaritalStatusesRepository;

export class MaritalStatusesService {
  constructor(private readonly repo: MaritalStatusRepo) {}

  findAll(country: string, page: number, size: number) {
    return this.repo.findAll(country, page, size);
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
