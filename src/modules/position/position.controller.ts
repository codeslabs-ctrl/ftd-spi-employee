import { NextFunction, Request, Response } from 'express';
import { validateDto } from '../../shared/utils/validate.util';
import { CreatePositionDto } from './dto/create-position.dto';
import { ListPositionsDto } from './dto/list-positions.dto';
import { SearchPositionDto } from './dto/search-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { createPositionsService, PositionsService } from './position.service';

function svc(): PositionsService {
  return createPositionsService();
}

export const positionController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(CreatePositionDto, req.body);
      const result = await svc().create(req.countryCode!, dto);
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  },

  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(SearchPositionDto, req.body);
      const result = await svc().findById(
        req.countryCode!,
        dto.companyId,
        dto.id,
      );
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(ListPositionsDto, req.body);
      const result = await svc().findAll(
        req.countryCode!,
        dto.page ?? 1,
        dto.size ?? 20,
        dto.companyId,
      );
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(UpdatePositionDto, req.body);
      const result = await svc().update(req.countryCode!, dto);
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  },
};
