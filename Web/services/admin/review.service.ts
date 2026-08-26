import mongoose from 'mongoose';
import Review from '../../models/review.model';
import AccountUser from '../../models/account-user.model';
import Product from '../../models/product.model';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { escapeRegex } from '../../helpers/generate.helper';

export const getReviewList = async (
  filterTab: string = "all",
  rawKeyword?: unknown,
  rawPage?: unknown
) => {
  const find: Record<string, unknown> = {};

  if (filterTab === "reported") {
    find.reportCount = { $gt: 0 };
  } else if (filterTab === "hidden") {
    find.status = "rejected";
  }

  if (rawKeyword) {
    const keyword = `${rawKeyword}`.trim();
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.comment = keywordRegex;
  }

  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await Review.countDocuments(find);
  const pagination = getPagination(rawPage, limitItems, totalRecord);

  const recordList = await Review
    .find(find)
    .select("_id userId productId rating comment images status reportCount createdAt")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({ createdAt: "desc" });

  const userIds = [...new Set(recordList.map((i) => i.userId))];
  const productIds = [...new Set(recordList.map((i) => i.productId))];

  const [users, products, reportedCount, hiddenCount] = await Promise.all([
    AccountUser.find({ _id: { $in: userIds } }).select("_id fullName email avatar"),
    Product.find({ _id: { $in: productIds } }).select("_id name images"),
    Review.countDocuments({ reportCount: { $gt: 0 } }),
    Review.countDocuments({ status: "rejected" })
  ]);

  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  for (const item of recordList) {
    const u = userMap.get(String(item.userId));
    if (u) item.user = { fullName: u.fullName, email: u.email, avatar: u.avatar };
    const p = productMap.get(String(item.productId));
    if (p) item.product = { name: p.name, images: p.images };
  }

  return {
    recordList,
    pagination,
    filterTab,
    reportedCount,
    hiddenCount
  };
};

export const deleteReviewById = async (id: string) => {
  const review = await Review.findById(id).select("_id productId");
  if (!review) {
    return { success: false, message: "Review not found!" };
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Review.deleteOne({ _id: id }, { session });

      if (review.productId) {
        const remaining = await Review.find({ productId: review.productId }, null, { session }).select("rating");
        const newCount = remaining.length;
        const newAvg = newCount > 0
          ? remaining.reduce((sum: number, r) => sum + r.rating, 0) / newCount
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

  return { success: true, message: "Review deleted successfully!" };
};

export const changeReviewStatus = async (id: string, status: string) => {
  await Review.updateOne({ _id: id }, { status });
  return { success: true, message: "Status updated successfully!" };
};

export const clearReviewReports = async (id: string) => {
  await Review.updateOne({ _id: id }, { $set: { reportCount: 0, reportedBy: [] } });
  return { success: true, message: "Reports cleared!" };
};

export const deleteManyReviews = async (ids: string[]) => {
  const reviews = await Review.find({ _id: { $in: ids } }).select("productId");
  const affectedProductIds = [...new Set(reviews.map(r => String(r.productId)).filter(Boolean))];

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Review.deleteMany({ _id: { $in: ids } }, { session });

      if (affectedProductIds.length > 0) {
        const remainingStats = await Review.aggregate([
          { $match: { productId: { $in: affectedProductIds } } },
          {
            $group: {
              _id: "$productId",
              count: { $sum: 1 },
              avg: { $avg: "$rating" }
            }
          }
        ]).session(session);

        const statsMap = new Map(
          remainingStats.map((s: { _id: string; count: number; avg: number }) => [String(s._id), s])
        );

        await Promise.all(
          affectedProductIds.map((productId) => {
            const stat = statsMap.get(productId);
            return Product.updateOne(
              { _id: productId },
              {
                ratingAvg: stat ? Number(stat.avg.toFixed(1)) : 0,
                ratingCount: stat ? stat.count : 0
              },
              { session }
            );
          })
        );
      }
    });
  } finally {
    session.endSession();
  }

  return { success: true, message: `Deleted ${ids.length} review(s) permanently!` };
};
