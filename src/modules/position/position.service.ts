import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { InMemoryPositionsRepository } from './in-memory-position.repository';
import { PositionsRepository } from './position.repository';

export type PositionRepo = PositionsRepository | InMemoryPositionsRepository;

export class PositionsService {
  constructor(private readonly repo: PositionRepo) {}

  create(country: string, dto: CreatePositionDto) {
    return this.repo.create(country, dto);
  }

  findById(country: string, companyId: string, id: string) {
    return this.repo.findById(country, companyId, id);
  }

  findAll(country: string, page: number, size: number, companyId?: string) {
    return this.repo.findAll(country, page, size, companyId);
  }

  update(country: string, dto: UpdatePositionDto) {
    return this.repo.update(country, dto);
  }
}

let singleton: PositionsService | null = null;

export function createPositionsService(): PositionsService {
  if (!singleton) {
    const repo =
      process.env.FAKE_DB === 'true'
        ? new InMemoryPositionsRepository()
        : new PositionsRepository();
    singleton = new PositionsService(repo);
  }
  return singleton;
}
