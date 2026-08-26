import { NextFunction, Request, Response } from "express";
import * as articleService from "../../services/client/article.service";

export const getPopularBlog = async (_req: Request, res: Response, next: NextFunction) => {
  const blogList = await articleService.getPopularArticles(3);
  res.locals.popularBlogList = blogList;
  next();
};

export const getPopularCategoryBlog = async (_req: Request, res: Response, next: NextFunction) => {
  const categories = await articleService.getPopularCategoriesWithCount();
  categories.sort((a, b) => (b.totalRecord ?? 0) - (a.totalRecord ?? 0));
  res.locals.popularCategoryBlogList = categories.slice(0, 5);
  next();
};
