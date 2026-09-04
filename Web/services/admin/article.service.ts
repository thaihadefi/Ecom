import { toSearchText } from '../../helpers/slugify.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import CategoryBlog from '../../models/category-blog.model';
import Blog from '../../models/blog.model';
import { IBlog, IArticleInput } from '../../interfaces/models/blog.interface';
import { ICategoryBlog, ICategoryBlogInput } from '../../interfaces/models/category-blog.interface';
import { IProductSeoInput } from '../../interfaces/models/product.interface';
import { buildSeoPayload } from '../../helpers/seo.helper';
import { buildCategoryTree } from '../../helpers/category.helper';
import { pingGoogleSitemap } from '../../helpers/ping-google.helper';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { softDeleteMany, restoreMany, permanentlyDeleteMany, getTrash } from "../../helpers/admin-crud.helper";

export const getCategoryBlogList = async (rawKeyword?: unknown, rawPage?: unknown) => {
  const find: {
    deleted: boolean;
    search?: RegExp;
  } = {
    deleted: false
  };

  if (rawKeyword) {
    const keyword = toSearchText(`${rawKeyword}`);
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }

  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await CategoryBlog.countDocuments(find);
  const pagination = getPagination(rawPage, limitItems, totalRecord);

  const recordList = await CategoryBlog
    .find(find)
    .select("_id name slug parent avatar status view")
    .sort({ createdAt: "desc" })
    .limit(limitItems)
    .skip(pagination.skip);

  const parentIds = [...new Set(recordList.filter((i) => i.parent).map((i) => String(i.parent)))];
  if (parentIds.length > 0) {
    const parents = await CategoryBlog.find({ _id: { $in: parentIds } }).select("_id name");
    const parentMap = new Map((parents as Array<{ _id: unknown; name?: string }>).map((p) => [String(p._id), p.name]));
    for (const item of recordList) {
      if (item.parent) item.parentName = parentMap.get(String(item.parent));
    }
  }

  const categoryTree = buildCategoryTree(recordList);

  return {
    categoryTree
  };
};

export const getCategoryBlogTreeForSelect = async () => {
  const recordList = await CategoryBlog.find({
    deleted: false
  }).select("_id name parent");

  const parentIds = [...new Set(recordList.map((i) => String(i.parent)).filter((id): id is string => Boolean(id) && id !== "undefined"))];
  if (parentIds.length > 0) {
    const parents = await CategoryBlog.find({ _id: { $in: parentIds } }).select("_id name");
    const parentMap = new Map((parents as Array<{ _id: unknown; name?: string }>).map((p) => [String(p._id), p.name]));
    for (const item of recordList) {
      if (item.parent) item.parentName = parentMap.get(String(item.parent));
    }
  }
  return recordList;
};

export const getCategoryBlogTrash = async () => {
  const recordList = await CategoryBlog.find({ deleted: true });
  const parentIds = [...new Set(recordList.filter((i) => i.parent).map((i) => String(i.parent)))];
  if (parentIds.length > 0) {
    const parents = await CategoryBlog.find({ _id: { $in: parentIds } }).select("name");
    const parentMap = new Map(parents.map((p) => [String(p._id), p.name]));
    for (const item of recordList) {
      if (item.parent) item.parentName = parentMap.get(String(item.parent));
    }
  }
  return recordList;
};

export const getCategoryBlogTree = async (filter: Record<string, unknown> = {}) => {
  const categoryList = await CategoryBlog.find(filter).select("_id name slug parent status");
  return buildCategoryTree(categoryList);
};

export const createCategoryBlog = async (data: ICategoryBlogInput): Promise<{ success: boolean; message: string; category?: ICategoryBlog }> => {
  const existSlug = await CategoryBlog.findOne({
    slug: String(data.slug || "")
  }).select("_id");

  if (existSlug) {
    return { success: false, message: "Slug already exists!" };
  }

  data.search = toSearchText(`${data.name}`);
  const newRecord = new CategoryBlog(data);
  await newRecord.save();

  return { success: true, message: "Category created successfully!", category: newRecord };
};

export const getCategoryBlogById = async (id: string) => {
  return CategoryBlog.findOne({ _id: id, deleted: false });
};

export const updateCategoryBlog = async (id: string, data: ICategoryBlogInput): Promise<{ success: boolean; message: string }> => {
  const existSlug = await CategoryBlog.findOne({
    _id: { $ne: id },
    slug: String(data.slug || "")
  }).select("_id");

  if (existSlug) {
    return { success: false, message: "Slug already exists!" };
  }

  data.search = toSearchText(`${data.name}`);
  await CategoryBlog.updateOne({ _id: id, deleted: false }, data);

  return { success: true, message: "Updated successfully!" };
};

export const softDeleteCategoryBlog = async (id: string) => {
  await CategoryBlog.updateOne({ _id: id }, { deleted: true, deletedAt: Date.now() });
  return { success: true, message: "Category deleted successfully!" };
};

export const restoreCategoryBlog = async (id: string) => {
  await CategoryBlog.updateOne({ _id: id }, { deleted: false });
  return { success: true, message: "Category restored successfully!" };
};

export const permanentlyDeleteCategoryBlog = async (id: string) => {
  await CategoryBlog.deleteOne({ _id: id });
  return { success: true, message: "Category permanently deleted!" };
};

export const softDeleteManyCategories = (ids: string[]) => softDeleteMany(CategoryBlog, ids, "category");

export const restoreManyCategories = (ids: string[]) => restoreMany(CategoryBlog, ids, "category");

export const permanentlyDeleteManyCategories = async (ids: string[]) => {
  return permanentlyDeleteMany(CategoryBlog, ids, "category");
};

export const getArticleList = async (rawKeyword?: unknown, rawPage?: unknown) => {
  const find: {
    deleted: boolean;
    search?: RegExp;
  } = {
    deleted: false
  };

  if (rawKeyword) {
    const keyword = toSearchText(`${rawKeyword}`);
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }

  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await Blog.countDocuments(find);
  const pagination = getPagination(rawPage, limitItems, totalRecord);

  const recordList = await Blog
    .find(find)
    .select("name avatar category status createdAt updatedAt createdBy updatedBy view")
    .sort({ createdAt: "desc" })
    .limit(limitItems)
    .skip(pagination.skip);

  return {
    recordList,
    pagination
  };
};

export const createArticle = async (data: IArticleInput, adminId?: string): Promise<{ success: boolean; message: string; article?: IBlog }> => {
  const existSlug = await Blog.findOne({
    slug: String(data.slug || "")
  }).select("_id");

  if (existSlug) {
    return { success: false, message: "Slug already exists!" };
  }

  if (typeof data.category === "string") {
    const rawCategory = data.category;
    try {
      data.category = JSON.parse(rawCategory);
    } catch {
      data.category = [rawCategory];
    }
  }

  data.search = toSearchText(`${data.name}`);
  if (data.status === "published") {
    data.publishAt = new Date();
  }

  data.createdBy = adminId;
  const newRecord = new Blog(data);
  await newRecord.save();

  await pingGoogleSitemap();

  return { success: true, message: "Article created successfully!", article: newRecord };
};

export const getArticleById = async (id: string) => {
  return Blog.findOne({ _id: id, deleted: false });
};

export const updateArticle = async (id: string, data: IArticleInput, adminId?: string): Promise<{ success: boolean; message: string }> => {
  const articleDetail = await Blog.findOne({ _id: id, deleted: false });
  if (!articleDetail) {
    return { success: false, message: "Article does not exist!" };
  }

  const existSlug = await Blog.findOne({
    _id: { $ne: id },
    slug: String(data.slug || "")
  }).select("_id");

  if (existSlug) {
    return { success: false, message: "Slug already exists!" };
  }

  if (typeof data.category === "string") {
    const rawCategory = data.category;
    try {
      data.category = JSON.parse(rawCategory);
    } catch {
      data.category = [rawCategory];
    }
  }

  data.search = toSearchText(`${data.name}`);
  if (data.status === "published") {
    data.publishAt = new Date();
  }

  data.updatedBy = adminId;
  await Blog.updateOne({ _id: id, deleted: false }, data);

  return { success: true, message: "Article updated successfully!" };
};

export const updateArticleSEO = async (id: string, body: IProductSeoInput): Promise<{ success: boolean; message: string }> => {
  const articleDetail = await Blog.findOne({ _id: id, deleted: false });
  if (!articleDetail) {
    return { success: false, message: "Article does not exist!" };
  }

  const seo = buildSeoPayload(body, {
    title: articleDetail.name,
    keywords: [],
    image: articleDetail.avatar || "",
  });

  await Blog.updateOne({ _id: id, deleted: false }, { seo });

  return { success: true, message: "SEO updated successfully!" };
};

export const softDeleteArticle = async (id: string) => {
  await Blog.updateOne({ _id: id }, { deleted: true, deletedAt: Date.now() });
  return { success: true, message: "Article deleted successfully!" };
};

export const restoreArticle = async (id: string) => {
  await Blog.updateOne({ _id: id }, { deleted: false });
  return { success: true, message: "Restored successfully!" };
};

export const permanentlyDeleteArticle = async (id: string) => {
  await Blog.deleteOne({ _id: id });
  return { success: true, message: "Deleted permanently!" };
};

export const softDeleteManyArticles = (ids: string[]) => softDeleteMany(Blog, ids, "article");

export const restoreManyArticles = (ids: string[]) => restoreMany(Blog, ids, "article");

export const permanentlyDeleteManyArticles = async (ids: string[]) => {
  return permanentlyDeleteMany(Blog, ids, "article");
};

export const getArticleTrash = () => getTrash(Blog, "_id name slug avatar status deletedAt");
