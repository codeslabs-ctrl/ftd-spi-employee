import { Request, Response } from 'express';
import { enabledCountries } from '../../config/db/oracle/tenant-pools';

export const healthController = {
  live: (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  },
  ready: (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', countries: enabledCountries() });
  },
};
