import { toSlug } from '../../helpers/slugify.helper';
import mongoose from 'mongoose';
import CategoryBlog from '../../models/category-blog.model';
import Blog from '../../models/blog.model';
import CategoryProduct from '../../models/category-product.model';
import Product from '../../models/product.model';
import { generateRandomString } from '../../helpers/generate.helper';

const models: Record<string, mongoose.Model<unknown>> = {
  CategoryBlog: CategoryBlog as unknown as mongoose.Model<unknown>,
  Blog: Blog as unknown as mongoose.Model<unknown>,
  CategoryProduct: CategoryProduct as unknown as mongoose.Model<unknown>,
  Product: Product as unknown as mongoose.Model<unknown>
};

export const generateUniqueSlug = async (rawString: unknown, modalName: string) => {
  let slug = toSlug(typeof rawString === "string" ? rawString : "");

  const Model = Object.prototype.hasOwnProperty.call(models, modalName) ? models[modalName] : undefined;
  if (!Model) {
    return { success: false, status: 400, message: "Invalid model!" };
  }

  const existSlug = await Model.findOne({ slug }).select("_id");
  if (existSlug) {
    const stringRandom = generateRandomString(4);
    slug = `${slug}-${stringRandom}`;
  }

  return {
    success: true,
    message: "Slug generated successfully!",
    slug
  };
};
