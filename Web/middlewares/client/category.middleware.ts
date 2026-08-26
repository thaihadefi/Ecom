import { NextFunction, Request, Response } from "express";
import * as categoryProductService from "../../services/admin/category-product.service";
import * as articleService from "../../services/admin/article.service";

export const getAllCategory = async (_req: Request, res: Response, next: NextFunction) => {
  const [categoryProductTree, categoryArticleTree] = await Promise.all([
    categoryProductService.getCategoryProductTree({ deleted: false }),
    articleService.getCategoryBlogTree({ deleted: false })
  ]);

  res.locals.categoryProductList = categoryProductTree;
  res.locals.categoryArticleList = categoryArticleTree;

  next();
};
