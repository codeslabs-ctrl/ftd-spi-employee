import { NextFunction, Request, Response } from 'express';
import { validateDto } from '../../shared/utils/validate.util';
import { authService } from './auth.service';
import { TokenRequestDto } from './dto/token-request.dto';

export const authController = {
  token: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(TokenRequestDto, req.body);
      const result = authService.issueToken(dto.client_id, dto.client_secret);
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  },
};
