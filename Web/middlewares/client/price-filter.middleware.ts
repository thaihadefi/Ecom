import { NextFunction, Request, Response } from "express";
import { getPriceFilterCeiling } from "../../services/client/product.service";

// Ceiling of the price range slider on product listing pages.
export const priceFilterCeiling = async (_req: Request, res: Response, next: NextFunction) => {
  res.locals.priceFilterMax = await getPriceFilterCeiling();
  next();
};
