import { InMemoryOrgUnitsRepository } from './in-memory-org-unit.repository';
import { OrgUnitsRepository } from './org-unit.repository';

export type OrgUnitRepo = OrgUnitsRepository | InMemoryOrgUnitsRepository;

export class OrgUnitsService {
  constructor(private readonly repo: OrgUnitRepo) {}

  findById(country: string, companyId: string, id: string) {
    return this.repo.findById(country, companyId, id);
  }

  findAll(country: string, page: number, size: number, companyId?: string) {
    return this.repo.findAll(country, page, size, companyId);
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
