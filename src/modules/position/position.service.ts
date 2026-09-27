import { fetchAllPages } from '../../shared/utils/fetch-all-pages.util';
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
