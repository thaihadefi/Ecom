import { NextFunction, Request, Response } from "express";
import Blog from "../../models/blog.model";
import moment from "moment";
import CategoryBlog from "../../models/category-blog.model";

export const getPopularBlog = async (_req: Request, res: Response, next: NextFunction) => {
  const blogList: any = await Blog
    .find({
      deleted: false,
      status: "published"
    })
    .select("name avatar slug createdAt")
    .sort({
      view: "desc"
    })
    .limit(3);

  for (const item of blogList) {
    if(item.createdAt) {
      item.createdAtFormat = moment(item.createdAt).format("DD/MM/YYYY");
    }
  }

  res.locals.popularBlogList = blogList;

  next();
}

export const getPopularCategoryBlog = async (_req: Request, res: Response, next: NextFunction) => {
  const categories: any[] = await CategoryBlog.find({
    deleted: false,
    status: "active"
  }).select("_id name slug").lean();

  const categoryIds = categories.map(item => item._id.toString());

  const counts = await Blog.aggregate([
    {
      $match: {
        category: { $in: categoryIds },
        deleted: false,
        status: "published"
      }
    },
    {
      $unwind: "$category"
    },
    {
      $match: {
        category: { $in: categoryIds }
      }
    },
    {
      $group: {
        _id: "$category",
        totalRecord: { $sum: 1 }
      }
    }
  ]);

  const countsMap = counts.reduce((acc, item) => {
    acc[item._id] = item.totalRecord;
    return acc;
  }, {} as Record<string, number>);

  for (const item of categories) {
    item.totalRecord = countsMap[item._id.toString()] || 0;
  }

  categories.sort((a, b) => b.totalRecord - a.totalRecord);

  res.locals.popularCategoryBlogList = categories.slice(0, 5);

  next();
}