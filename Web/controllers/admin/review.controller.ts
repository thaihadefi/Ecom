import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Review from '../../models/review.model';
import AccountUser from '../../models/account-user.model';
import Product from '../../models/product.model';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { escapeRegex } from '../../helpers/generate.helper';

export const list = async (req: Request, res: Response) => {
  const find: any = {};

  const filterTab = req.query.filter || "all";
  if (filterTab === "reported") {
    find.reportCount = { $gt: 0 };
  } else if (filterTab === "hidden") {
    find.status = "rejected";
  }

  if(req.query.keyword) {
    const keyword = `${req.query.keyword}`.trim();
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.comment = keywordRegex;
  }

  // Pagination
  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await Review.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination
  
  const recordList: any = await Review
    .find(find)
    .select("_id userId productId rating comment images status reportCount createdAt")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({ createdAt: "desc" })

  const userIds = [...new Set(recordList.map((i: any) => i.userId))];
  const productIds = [...new Set(recordList.map((i: any) => i.productId))];

  const [users, products] = await Promise.all([
    AccountUser.find({ _id: { $in: userIds } }).select("_id fullName email avatar"),
    Product.find({ _id: { $in: productIds } }).select("_id name images")
  ]);

  const userMap = new Map((users as any[]).map((u: any) => [String(u._id), u]));
  const productMap = new Map((products as any[]).map((p: any) => [String(p._id), p]));

  for (const item of recordList) {
    const u = userMap.get(String(item.userId));
    if (u) item.user = { fullName: (u as any).fullName, email: (u as any).email, avatar: (u as any).avatar };
    const p = productMap.get(String(item.productId));
    if (p) item.product = { name: (p as any).name, images: (p as any).images };
  }
  
  const reportedCount = await Review.countDocuments({ reportCount: { $gt: 0 } });
  const hiddenCount = await Review.countDocuments({ status: "rejected" });

  res.render("admin/pages/review-list", {
    pageTitle: "Manage Reviews",
    recordList: recordList,
    pagination: pagination,
    filterTab: filterTab,
    reportedCount: reportedCount,
    hiddenCount: hiddenCount
  });
}

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const review: any = await Review.findById(req.params.id).select("_id productId");
    if (!review) {
      res.json({ code: "error", message: "Review not found!" });
      return;
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Review.deleteOne({ _id: req.params.id }, { session });

        if (review.productId) {
          const remaining = await Review.find({ productId: review.productId }, null, { session }).select("rating");
          const newCount = remaining.length;
          const newAvg = newCount > 0
            ? remaining.reduce((sum: number, r: any) => sum + r.rating, 0) / newCount
            : 0;
          await Product.updateOne(
            { _id: review.productId },
            { ratingAvg: newAvg, ratingCount: newCount },
            { session }
          );
        }
      });
    } finally {
      session.endSession();
    }

    res.json({ code: "success", message: "Review deleted successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
}

export const changeStatusPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const status = req.params.status;

    await Review.updateOne({
      _id: id
    }, {
      status: status
    });

    res.json({
      code: "success",
      message: "Status updated successfully!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    })
  }
}
export const clearReportsPatch = async (req: Request, res: Response) => {
  try {
    await Review.updateOne({ _id: req.params.id }, {
      $set: { reportCount: 0, reportedBy: [] }
    });
    res.json({ code: "success", message: "Reports cleared!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
}

export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }

    // Get affected product IDs before deleting
    const reviews: any[] = await Review.find({ _id: { $in: ids } }).select("productId");
    const affectedProductIds = [...new Set(reviews.map(r => String(r.productId)).filter(Boolean))];

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Review.deleteMany({ _id: { $in: ids } }, { session });

        // Recalculate ratings for all affected products
        await Promise.all(
          affectedProductIds.map(async (productId) => {
            const remaining = await Review.find({ productId }, null, { session }).select("rating");
            const newCount = remaining.length;
            const newAvg = newCount > 0
              ? remaining.reduce((sum: number, r: any) => sum + r.rating, 0) / newCount
              : 0;
            await Product.updateOne(
              { _id: productId },
              { ratingAvg: newAvg, ratingCount: newCount },
              { session }
            );
          })
        );
      });
    } finally {
      session.endSession();
    }

    res.json({ code: "success", message: `Deleted ${ids.length} review(s) permanently!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};
