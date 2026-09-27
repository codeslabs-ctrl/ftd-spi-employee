import { fetchAllPages } from '../../shared/utils/fetch-all-pages.util';
import { InMemoryJobPostsRepository } from './in-memory-job-post.repository';
import { JobPostsRepository } from './job-post.repository';

export type JobPostRepo = JobPostsRepository | InMemoryJobPostsRepository;

export class JobPostsService {
  constructor(private readonly repo: JobPostRepo) {}

  findById(
    country: string,
    companyId: string,
    unitId: string,
    id: string,
  ) {
    return this.repo.findById(country, companyId, unitId, id);
  }

  async findAll(
    country: string,
    page: number,
    size: number,
    companyId?: string,
    unitId?: string,
    positionId?: string,
    paginate = true,
  ) {
    if (!paginate) {
      const items = await fetchAllPages((p, s) =>
        this.repo.findAll(country, p, s, companyId, unitId, positionId),
      );
      return { page: 1, size: items.length, paginate: false, items };
    }
    const result = await this.repo.findAll(
      country,
      page,
      size,
      companyId,
      unitId,
      positionId,
    );
    return { ...result, paginate: true };
  }
}

let singleton: JobPostsService | null = null;

export function createJobPostsService(): JobPostsService {
  if (!singleton) {
    const repo =
      process.env.FAKE_DB === 'true'
        ? new InMemoryJobPostsRepository()
        : new JobPostsRepository();
    singleton = new JobPostsService(repo);
  }
  return singleton;
}
