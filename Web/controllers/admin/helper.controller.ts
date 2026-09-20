import { Request, Response } from 'express';
import * as helperService from '../../services/admin/helper.service';
import { resultStatus, sendCaughtError } from "../../helpers/http-response.helper";

export const generateSlugPost = async (req: Request, res: Response) => {
  try {
    const { string, modalName } = req.body;
    const result = await helperService.generateUniqueSlug(string, modalName);

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message,
      slug: result.slug
    });
  } catch (error) {
    console.error("generateSlugPost error:", error);
    sendCaughtError(res, error, "Invalid model!", "Invalid model!");
  }
};
