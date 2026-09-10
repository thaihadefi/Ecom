import { NextFunction, Request, Response } from "express";
import * as attributeProductService from "../../services/admin/attribute-product.service";

export const getAttributeProduct = async (_req: Request, res: Response, next: NextFunction) => {
  const attributeProductList = await attributeProductService.getActiveAttributes();
  res.locals.attributeProductList = attributeProductList;
  next();
};
