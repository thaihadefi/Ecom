import { toSearchText } from '../../helpers/slugify.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import CategoryProduct from '../../models/category-product.model';
import { ICategoryProduct, ICategoryProductInput } from '../../interfaces/models/category-product.interface';
import { buildCategoryTree } from '../../helpers/category.helper';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';

export const getCategoryProductList = async (rawKeyword?: unknown, rawPage?: unknown) => {
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
  const totalRecord = await CategoryProduct.countDocuments(find);
  const pagination = getPagination(rawPage, limitItems, totalRecord);

  const recordList = await CategoryProduct
    .find(find)
    .select("_id name slug parent avatar status view")
    .sort({ createdAt: "desc" })
    .limit(limitItems)
    .skip(pagination.skip);

  const parentIds = [...new Set(recordList.filter((i) => i.parent).map((i) => String(i.parent)))];
  if (parentIds.length > 0) {
    const parents = await CategoryProduct.find({ _id: { $in: parentIds } }).select("name");
    const parentMap = new Map(parents.map((p) => [String(p._id), p.name]));
    for (const item of recordList) {
      if (item.parent) item.parentName = parentMap.get(String(item.parent));
    }
  }

  return {
    recordList,
    pagination
  };
};

export const getCategoryProductTree = async (filter: Record<string, unknown> = {}) => {
  const categoryList = await CategoryProduct.find(filter).select("_id name slug parent status");
  return buildCategoryTree(categoryList);
};

export const createCategoryProduct = async (data: ICategoryProductInput): Promise<{ success: boolean; message: string; category?: ICategoryProduct }> => {
  const existSlug = await CategoryProduct.findOne({
    slug: String(data.slug || "")
  }).select("_id");

  if (existSlug) {
    return { success: false, message: "Slug already exists!" };
  }

  data.search = toSearchText(`${data.name}`);
  const newRecord = new CategoryProduct(data);
  await newRecord.save();

  return { success: true, message: "Category created successfully!", category: newRecord };
};

export const getCategoryProductById = async (id: string) => {
  return CategoryProduct.findOne({ _id: id, deleted: false });
};

export const updateCategoryProduct = async (id: string, data: ICategoryProductInput): Promise<{ success: boolean; message: string }> => {
  const existSlug = await CategoryProduct.findOne({
    _id: { $ne: id },
    slug: String(data.slug || "")
  }).select("_id");

  if (existSlug) {
    return { success: false, message: "Slug already exists!" };
  }

  data.search = toSearchText(`${data.name}`);
  await CategoryProduct.updateOne({ _id: id, deleted: false }, data);

  return { success: true, message: "Updated successfully!" };
};

export const softDeleteCategoryProduct = async (id: string) => {
  await CategoryProduct.updateOne({ _id: id }, { deleted: true, deletedAt: Date.now() });
  return { success: true, message: "Category deleted successfully!" };
};

export const restoreCategoryProduct = async (id: string) => {
  await CategoryProduct.updateOne({ _id: id }, { deleted: false });
  return { success: true, message: "Restored successfully!" };
};

export const permanentlyDeleteCategoryProduct = async (id: string) => {
  await CategoryProduct.deleteOne({ _id: id });
  return { success: true, message: "Deleted permanently!" };
};

export const getCategoryProductTrash = async () => {
  const recordList = await CategoryProduct.find({ deleted: true }).sort({ deletedAt: "desc" });
  const parentIds = [...new Set(recordList.filter((i) => i.parent).map((i) => String(i.parent)))];
  if (parentIds.length > 0) {
    const parents = await CategoryProduct.find({ _id: { $in: parentIds } }).select("name");
    const parentMap = new Map(parents.map((p) => [String(p._id), p.name]));
    for (const item of recordList) {
      if (item.parent) item.parentName = parentMap.get(String(item.parent));
    }
  }
  return recordList;
};

export const softDeleteManyCategoryProducts = async (ids: string[]) => {
  await CategoryProduct.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
  return { success: true, message: `Moved ${ids.length} category(s) to trash!` };
};

export const restoreManyCategoryProducts = async (ids: string[]) => {
  await CategoryProduct.updateMany({ _id: { $in: ids } }, { deleted: false });
  return { success: true, message: `Restored ${ids.length} category(s)!` };
};

export const permanentlyDeleteManyCategoryProducts = async (ids: string[]) => {
  await CategoryProduct.deleteMany({ _id: { $in: ids } });
  return { success: true, message: `Permanently deleted ${ids.length} category(s)!` };
};
