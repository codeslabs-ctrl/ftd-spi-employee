import { CompaniesRepository } from './company.repository';
import { InMemoryCompaniesRepository } from './in-memory-company.repository';

export type CompanyRepo = CompaniesRepository | InMemoryCompaniesRepository;

export class CompaniesService {
  constructor(private readonly repo: CompanyRepo) {}

  findById(country: string, id: string) {
    return this.repo.findById(country, id);
  }

  findAll(country: string, page: number, size: number) {
    return this.repo.findAll(country, page, size);
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
