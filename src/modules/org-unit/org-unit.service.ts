import { fetchAllPages } from '../../shared/utils/fetch-all-pages.util';
import { InMemoryOrgUnitsRepository } from './in-memory-org-unit.repository';
import { OrgUnitsRepository } from './org-unit.repository';

export type OrgUnitRepo = OrgUnitsRepository | InMemoryOrgUnitsRepository;

export class OrgUnitsService {
  constructor(private readonly repo: OrgUnitRepo) {}

  findById(country: string, companyId: string, id: string) {
    return this.repo.findById(country, companyId, id);
  }

  async findAll(
    country: string,
    page: number,
    size: number,
    companyId?: string,
    paginate = true,
  ) {
    if (!paginate) {
      const items = await fetchAllPages((p, s) =>
        this.repo.findAll(country, p, s, companyId),
      );
      return { page: 1, size: items.length, paginate: false, items };
    }
    const result = await this.repo.findAll(country, page, size, companyId);
    return { ...result, paginate: true };
  }
}

let singleton: OrgUnitsService | null = null;

export function createOrgUnitsService(): OrgUnitsService {
  if (!singleton) {
    const repo =
      process.env.FAKE_DB === 'true'
        ? new InMemoryOrgUnitsRepository()
        : new OrgUnitsRepository();
    singleton = new OrgUnitsService(repo);
  }
  return singleton;
}
