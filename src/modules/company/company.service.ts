import { fetchAllPages } from '../../shared/utils/fetch-all-pages.util';
import { CompaniesRepository } from './company.repository';
import { InMemoryCompaniesRepository } from './in-memory-company.repository';

export type CompanyRepo = CompaniesRepository | InMemoryCompaniesRepository;

export class CompaniesService {
  constructor(private readonly repo: CompanyRepo) {}

  findById(country: string, id: string) {
    return this.repo.findById(country, id);
  }

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

let singleton: CompaniesService | null = null;

export function createCompaniesService(): CompaniesService {
  if (!singleton) {
    const repo =
      process.env.FAKE_DB === 'true'
        ? new InMemoryCompaniesRepository()
        : new CompaniesRepository();
    singleton = new CompaniesService(repo);
  }
  return singleton;
}
