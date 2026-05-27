import { NextFunction, Request, Response } from "express";
import CategoryProduct from "../../models/category-product.model";
import { buildCategoryTree } from "../../helpers/category.helper";
import CategoryBlog from "../../models/category-blog.model";

export const getAllCategory = async (req: Request, res: Response, next: NextFunction) => {
  // Product category list
  const categoryProductList = await CategoryProduct.find({
    deleted: false
  }).select("_id name slug parent avatar status");
  const categoryProductTree = buildCategoryTree(categoryProductList);
  res.locals.categoryProductList = categoryProductTree;
  // End Product category list

  // Article category list
  const categoryArticleList = await CategoryBlog.find({
    deleted: false
  }).select("_id name slug parent avatar status");
  const categoryArticleTree = buildCategoryTree(categoryArticleList);
  res.locals.categoryArticleList = categoryArticleTree;
  // End Article category list

  next();
}