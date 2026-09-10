import { Request, Response } from 'express';
import * as reviewService from '../../services/admin/review.service';

export const list = async (req: Request, res: Response) => {
  const filterTab = (req.query.filter as string) || "all";
  const data = await reviewService.getReviewList(filterTab, req.query.keyword, req.query.page);

  res.render("admin/pages/review-list", {
    pageTitle: "Manage Reviews",
    ...data
  });
};

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const result = await reviewService.deleteReviewById(req.params.id);
    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("review deletePatch error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const changeStatusPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const status = req.params.status;

    const result = await reviewService.changeReviewStatus(id, status);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("review changeStatusPatch error:", error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    });
  }
};

export const clearReportsPatch = async (req: Request, res: Response) => {
  try {
    const result = await reviewService.clearReviewReports(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("review clearReportsPatch error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }

    const result = await reviewService.deleteManyReviews(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("review destroyManyDelete error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};
