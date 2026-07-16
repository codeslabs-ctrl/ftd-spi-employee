import { NextFunction, Request, Response } from 'express';
import { validateDto } from '../../shared/utils/validate.util';
import { ListJobPostsDto } from './dto/list-job-posts.dto';
import { SearchJobPostDto } from './dto/search-job-post.dto';
import { createJobPostsService, JobPostsService } from './job-post.service';

function svc(): JobPostsService {
  return createJobPostsService();
}

export const jobPostController = {
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(SearchJobPostDto, req.body);
      const result = await svc().findById(
        req.countryCode!,
        dto.companyId,
        dto.unitId,
        dto.id,
      );
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(ListJobPostsDto, req.body);
      const result = await svc().findAll(
        req.countryCode!,
        dto.page ?? 1,
        dto.size ?? 20,
        dto.companyId,
        dto.unitId,
        dto.positionId,
      );
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  },
};
