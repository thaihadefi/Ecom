import { Request, Response } from 'express';
import { pathAdmin } from '../../configs/variable.config';
import { logAdminAction } from '../../helpers/log.helper';
import * as couponService from '../../services/admin/coupon.service';
import { resultStatus, sendCaughtError } from "../../helpers/http-response.helper";

export const create = async (_req: Request, res: Response) => {
  res.render("admin/pages/coupon-create", {
    pageTitle: "Create Coupon"
  });
};

export const createPost = async (req: Request, res: Response) => {
  try {
    const result = await couponService.createCoupon(req.body);

    if (!result.success) {
      res.status(resultStatus(result)).json({
        code: "error",
        message: result.message
      });
      return;
    }

    logAdminAction(req, `Created coupon: ${req.body.code} (Id: ${result.coupon?.id})`);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("coupon createPost error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const list = async (req: Request, res: Response) => {
  const data = await couponService.getCouponList(req.query.keyword, req.query.page);

  res.render("admin/pages/coupon-list", {
    pageTitle: "Manage Coupons",
    ...data
  });
};

export const edit = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const couponDetail = await couponService.getCouponDetailById(id);

    if (!couponDetail) {
      res.redirect(`/${pathAdmin}/coupon/list`);
      return;
    }

    res.render("admin/pages/coupon-edit", {
      pageTitle: "Edit Coupon",
      couponDetail: couponDetail
    });
  } catch (error) {
    console.error("coupon edit error:", error);
    res.redirect(`/${pathAdmin}/coupon/list`);
  }
};

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await couponService.updateCoupon(id, req.body);

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("coupon editPatch error:", error);
    sendCaughtError(res, error, "Invalid ID!");
  }
};

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await couponService.softDeleteCoupon(id);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("coupon deletePatch error:", error);
    sendCaughtError(res, error, "Invalid ID!");
  }
};

export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.status(400).json({ code: "error", message: "No items selected!" });
      return;
    }
    const result = await couponService.permanentlyDeleteManyCoupons(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const trash = async (_req: Request, res: Response) => {
  const recordList = await couponService.getCouponTrash();
  res.render("admin/pages/coupon-trash", { pageTitle: "Coupon Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    const result = await couponService.restoreCoupon(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    sendCaughtError(res, error, "Invalid ID!");
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    const result = await couponService.permanentlyDeleteCoupon(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    sendCaughtError(res, error, "Invalid ID!");
  }
};

export const deleteManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.status(400).json({ code: "error", message: "No items selected!" });
      return;
    }
    const result = await couponService.softDeleteManyCoupons(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const undoManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.status(400).json({ code: "error", message: "No items selected!" });
      return;
    }
    const result = await couponService.restoreManyCoupons(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    sendCaughtError(res, error, "Invalid data!");
  }
};
