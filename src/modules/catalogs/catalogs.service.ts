import { fetchAllPages } from '../../shared/utils/fetch-all-pages.util';
import { CatalogFilters } from './catalog.definitions';
import { CatalogsRepository } from './catalogs.repository';
import { InMemoryCatalogsRepository } from './in-memory-catalogs.repository';

export type CatalogsRepo = CatalogsRepository | InMemoryCatalogsRepository;

export class CatalogsService {
  constructor(private readonly repo: CatalogsRepo) {}

  async findAll(
    country: string,
    catalogKey: string,
    page: number,
    size: number,
    filters: CatalogFilters = {},
    paginate = true,
  ) {
    if (!paginate) {
      const items = await fetchAllPages((p, s) =>
        this.repo.findAll(country, catalogKey, p, s, filters),
      );
      return { page: 1, size: items.length, paginate: false, items };
    }
    const result = await this.repo.findAll(
      country,
      catalogKey,
      page,
      size,
      filters,
    );
    return { ...result, paginate: true };
  }

  validateReentry(country: string, numIden: string, reingreso: 'SI' | 'NO') {
    return this.repo.validateReentry(country, numIden, reingreso);
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
