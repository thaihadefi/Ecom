import { toSearchText } from '../../helpers/slugify.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import { Request, Response } from 'express';
import Coupon from '../../models/coupon.model';
import moment from 'moment';
import { pathAdmin } from '../../configs/variable.config';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { logAdminAction } from '../../helpers/log.helper';

export const create = async (req: Request, res: Response) => {
  res.render("admin/pages/coupon-create", {
    pageTitle: "Create Coupon"
  });
}

export const createPost = async (req: Request, res: Response) => {
  try {
    const existCoupon = await Coupon.findOne({
      code: req.body.code,
      deleted: false
    }).select("_id")

    if(existCoupon) {
      res.json({
        code: "error",
        message: "Coupon already exists!"
      })
      return;
    }

    req.body.value = req.body.value ? parseInt(req.body.value) : 0;
    req.body.minOrderValue = req.body.minOrderValue ? parseInt(req.body.minOrderValue) : 0;
    req.body.maxDiscountValue = req.body.maxDiscountValue ? parseInt(req.body.maxDiscountValue) : 0;
    req.body.usageLimit = req.body.usageLimit ? parseInt(req.body.usageLimit) : 0;
    req.body.startDate = req.body.startDate ? moment(req.body.startDate, "DD/MM/YYYY").toDate() : undefined;
    req.body.endDate = req.body.endDate ? moment(req.body.endDate, "DD/MM/YYYY").toDate() : undefined;

    req.body.search = toSearchText(`${req.body.code} ${req.body.name}`);

    const newRecord = new Coupon(req.body);
    await newRecord.save();

    logAdminAction(req, `Created coupon: ${req.body.code} (Id: ${newRecord.id})`);

    res.json({
      code: "success",
      message: "Coupon created successfully!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const list = async (req: Request, res: Response) => {
  const find: {
    deleted: boolean,
    search?: RegExp
  } = {
    deleted: false
  };

  if(req.query.keyword) {
    const keyword = toSearchText(`${req.query.keyword}`)
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }

  // Pagination
  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await Coupon.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination

  const recordList: any = await Coupon
    .find(find)
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({
      createdAt: "desc"
    });

  for (const item of recordList) {
    if(item.startDate) {
      item.startDateFormat = moment(item.startDate).format("DD/MM/YYYY");
    }
    if(item.endDate) {
      item.endDateFormat = moment(item.endDate).format("DD/MM/YYYY");
    }
  }

  res.render("admin/pages/coupon-list", {
    pageTitle: "Manage Coupons",
    recordList: recordList,
    pagination: pagination
  });
}

export const edit = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const couponDetail: any = await Coupon.findOne({
      _id: id,
      deleted: false
    })

    if(!couponDetail) {
      res.redirect(`/${pathAdmin}/coupon/list`);
      return;
    }

    if(couponDetail.startDate) {
      couponDetail.startDateFormat = moment(couponDetail.startDate).format("DD/MM/YYYY");
    }
    if(couponDetail.endDate) {
      couponDetail.endDateFormat = moment(couponDetail.endDate).format("DD/MM/YYYY");
    }

    res.render("admin/pages/coupon-edit", {
      pageTitle: "Edit Coupon",
      couponDetail: couponDetail
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/coupon/list`);
  }
}

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const couponDetail = await Coupon.findOne({
      _id: id,
      deleted: false
    })

    if(!couponDetail) {
      res.json({
        code: "error",
        message: "ID does not exist!"
      })
      return;
    }

    const existCoupon = await Coupon.findOne({
      _id: { $ne: id },
      code: req.body.code,
      deleted: false
    }).select("_id");

    if(existCoupon) {
      res.json({
        code: "error",
        message: "Coupon already exists!"
      })
      return;
    }

    req.body.value = req.body.value ? parseInt(req.body.value) : 0;
    req.body.minOrderValue = req.body.minOrderValue ? parseInt(req.body.minOrderValue) : 0;
    req.body.maxDiscountValue = req.body.maxDiscountValue ? parseInt(req.body.maxDiscountValue) : 0;
    req.body.usageLimit = req.body.usageLimit ? parseInt(req.body.usageLimit) : 0;
    req.body.startDate = req.body.startDate ? moment(req.body.startDate, "DD/MM/YYYY").toDate() : undefined;
    req.body.endDate = req.body.endDate ? moment(req.body.endDate, "DD/MM/YYYY").toDate() : undefined;

    req.body.search = toSearchText(`${req.body.code} ${req.body.name}`)

    await Coupon.updateOne({
      _id: id,
      deleted: false
    }, req.body);

    res.json({
      code: "success",
      message: "Updated successfully!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    })
  }
}

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await Coupon.updateOne({
      _id: id
    }, {
      deleted: true,
      deletedAt: Date.now(),
    });

    res.json({
      code: "success",
      message: "Coupon deleted successfully!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    })
  }
}
export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
    await Coupon.deleteMany({ _id: { $in: ids } });
    res.json({ code: "success", message: `Deleted ${ids.length} coupon(s) permanently!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const trash = async (req: Request, res: Response) => {
  const recordList: any = await Coupon.find({ deleted: true }).select("_id name code status deletedAt").sort({ deletedAt: "desc" });
  res.render("admin/pages/coupon-trash", { pageTitle: "Coupon Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    await Coupon.updateOne({ _id: req.params.id }, { deleted: false });
    res.json({ code: "success", message: "Restored successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    await Coupon.deleteOne({ _id: req.params.id });
    res.json({ code: "success", message: "Deleted permanently!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const deleteManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await Coupon.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
    res.json({ code: "success", message: `Moved ${ids.length} coupon(s) to trash!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const undoManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await Coupon.updateMany({ _id: { $in: ids } }, { deleted: false });
    res.json({ code: "success", message: `Restored ${ids.length} coupon(s)!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const changeMultiPatch = async (req: Request, res: Response) => {
  try {
    const { value, ids } = req.body;
    if (!value || !ids || !ids.length) { res.json({ code: "error", message: "Invalid data!" }); return; }
    switch (value) {
      case "undo":
        await Coupon.updateMany({ _id: { $in: ids } }, { deleted: false });
        res.json({ code: "success", message: `Restored ${ids.length} coupon(s)!` });
        break;
      case "destroy":
        await Coupon.deleteMany({ _id: { $in: ids } });
        res.json({ code: "success", message: `Permanently deleted ${ids.length} coupon(s)!` });
        break;
      default:
        res.json({ code: "error", message: "Invalid action!" });
    }
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};
