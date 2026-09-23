import { Request, Response } from 'express';
import * as compareService from '../../services/client/compare.service';
import { sendCaughtError } from "../../helpers/http-response.helper";

export const compare = (_req: Request, res: Response) => {
  res.render("client/pages/compare", {
    pageTitle: "Product Compare"
  });
};

export const list = async (req: Request, res: Response) => {
  try {
    const compareList = Array.isArray(req.body) ? req.body : [];
    const compareDetail = await compareService.getCompareDetailList(compareList);

    res.json({
      code: "success",
      message: "Success!",
      compareList: compareDetail
    });
  } catch (error) {
    console.error("compare list error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};
