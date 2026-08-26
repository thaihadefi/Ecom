import { Request, Response } from 'express';
import * as compareService from '../../services/client/compare.service';

export const compare = (_req: Request, res: Response) => {
  res.render("client/pages/compare", {
    pageTitle: "Product Compare"
  });
};

export const list = async (req: Request, res: Response) => {
  try {
    const compareList = req.body || [];
    const compareDetail = await compareService.getCompareDetailList(compareList);

    res.json({
      code: "success",
      message: "Success!",
      compareList: compareDetail
    });
  } catch (error) {
    console.error("compare list error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};
