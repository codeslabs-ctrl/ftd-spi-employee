import { CatalogsRepository } from './catalogs.repository';
import { InMemoryCatalogsRepository } from './in-memory-catalogs.repository';

export type CatalogsRepo = CatalogsRepository | InMemoryCatalogsRepository;

export class CatalogsService {
  constructor(private readonly repo: CatalogsRepo) {}

  findAll(country: string, catalogKey: string, page: number, size: number) {
    return this.repo.findAll(country, catalogKey, page, size);
  }
}

let singleton: CatalogsService | null = null;

export function createCatalogsService(): CatalogsService {
  if (!singleton) {
    const repo =
      process.env.FAKE_DB === 'true'
        ? new InMemoryCatalogsRepository()
        : new CatalogsRepository();
    singleton = new CatalogsService(repo);
  }
  return singleton;
}
