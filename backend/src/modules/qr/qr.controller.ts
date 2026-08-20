import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as qrService from './qr.service';

export const getRestaurantQrHandler = asyncHandler(async (req: Request, res: Response) => {
  const qr = await qrService.getRestaurantQr(req.params.id!, req.user!.id);
  res.status(200).json({ success: true, data: qr });
});
