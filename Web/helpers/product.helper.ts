import moment from "moment";
import AccountAdmin from "../models/account-admin.model";
import Blog from "../models/blog.model";
import CategoryBlog from "../models/category-blog.model";
import CategoryProduct from "../models/category-product.model";
import Product from "../models/product.model";
import { IProductVariant, IProductAttributeValue } from "../interfaces/models/product.interface";
import { IAccountAdmin } from "../interfaces/models/account-admin.interface";

export interface GetByCategoryOptions {
  category?: string[];
  limit?: number;
  sort?: {
    by: string;
    type: string | number;
  };
  type?: string;
}

export interface IProductFormattable {
  priceOld?: number | null;
  priceNew?: number | null;
  discount?: number;
  variants?: IProductVariant[];
  colorList?: string[];
}

export const formatProductItem = (item: IProductFormattable) => {
  item.discount = Math.floor((((item.priceOld ?? 0) - (item.priceNew ?? 0)) / (item.priceOld ?? 1)) * 100);

  const colorSet = new Set<string>();
  (item.variants || [])
    .filter((variant: IProductVariant) => variant.status)
    .forEach((variant: IProductVariant) => {
      (variant.attributeValue || []).forEach((attr: IProductAttributeValue) => {
        if ((attr as IProductAttributeValue & { attrType?: string }).attrType === "color") {
          colorSet.add(attr.value);
        }
      });
    });
  item.colorList = [...colorSet];
};

export const getProductByCategory = async (getByCategory: GetByCategoryOptions) => {
  const find: Record<string, unknown> = {
    deleted: false,
    status: "active"
  };

  if (getByCategory.category && getByCategory.category.length) {
    const categoryList = await CategoryProduct.find({
      slug: { $in: getByCategory.category },
      deleted: false,
      status: "active"
    }).select("_id");
    const categoryIds = categoryList.map((category) => category.id);
    find.category = { $in: categoryIds };
  }

  const limit = getByCategory.limit ?? 10;

  const sort: Record<string, 1 | -1 | "asc" | "desc"> = {};
  if (getByCategory.sort?.by && getByCategory.sort?.type) {
    sort[getByCategory.sort.by] = getByCategory.sort.type as 1 | -1 | "asc" | "desc";
  }

  const productList = await Product
    .find(find)
    .select("_id name slug priceOld priceNew images variants category status ratingAvg ratingCount")
    .sort(sort)
    .limit(limit);

  for (const item of productList) {
    formatProductItem(item.toObject());
  }

  return productList;
};

export const getBlogByCategory = async (getByCategory: GetByCategoryOptions) => {
  const find: Record<string, unknown> = {
    deleted: false,
    status: "published"
  };

  if (getByCategory.category && getByCategory.category.length) {
    const categoryList = await CategoryBlog.find({
      slug: { $in: getByCategory.category },
      deleted: false,
      status: "active"
    }).select("_id");
    const categoryIds = categoryList.map((category) => category.id);
    find.category = { $in: categoryIds };
  }

  const limit = getByCategory.limit ?? 10;

  const sort: Record<string, 1 | -1 | "asc" | "desc"> = {};
  if (getByCategory.sort?.by && getByCategory.sort?.type) {
    sort[getByCategory.sort.by] = getByCategory.sort.type as 1 | -1 | "asc" | "desc";
  }

  const blogList = await Blog
    .find(find)
    .select("name avatar slug category createdBy updatedBy createdAt updatedAt")
    .sort(sort)
    .limit(limit);

  const adminIds = [...new Set(blogList.map((i) => String(i.updatedBy || i.createdBy)).filter(Boolean))];
  if (adminIds.length > 0) {
    const admins: Pick<IAccountAdmin, "_id" | "fullName">[] = await AccountAdmin.find({ _id: { $in: adminIds } }).select("_id fullName");
    const adminMap = new Map(admins.map((a) => [String(a._id), a.fullName]));
    for (const item of blogList) {
      const id = item.updatedBy || item.createdBy;
      const name = id ? adminMap.get(String(id)) : undefined;
      if (name) {
        item.authorName = name;
        item.date = moment(item.updatedBy ? item.updatedAt : item.createdAt).format("DD/MM/YYYY");
      }
    }
  }

  return blogList;
};
