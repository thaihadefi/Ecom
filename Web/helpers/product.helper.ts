import moment from "moment";
import AccountAdmin from "../models/account-admin.model";
import Blog from "../models/blog.model";
import CategoryBlog from "../models/category-blog.model";
import CategoryProduct from "../models/category-product.model";
import Product from "../models/product.model";

export const formatProductItem = (item: any) => {
  // Discount
  item.discount = Math.floor(((item.priceOld - item.priceNew) / item.priceOld) * 100);

  // Color
  const colorSet = new Set();
  (item.variants || [])
    .filter((variant: any) => variant.status)
    .forEach((variant: any) => {
      (variant.attributeValue || []).forEach((attr: any) => {
        if(attr.attrType == "color") {
          colorSet.add(attr.value);
        }
      })
    })
  item.colorList = [...colorSet];
}

export const getProductByCategory = async (getByCategory: any) => {
  let productList: any[] = [];

  // Create find options object
  const find: any = {
    deleted: false,
    status: "active"
  };

  // Get categories IDs array
  if(getByCategory.category && getByCategory.category.length) {
    const categoryList = await CategoryProduct.find({
      slug: { $in: getByCategory.category },
      deleted: false,
      status: "active"
    }).select("_id");
    const categoryIds = categoryList.map((category: any) => category.id);
    find.category = { $in: categoryIds };
  }

  // Get product limit
  let limit = 10;
  if(getByCategory.limit) {
    limit = getByCategory.limit;
  }

  // Sort
  const sort: any = {};
  if(getByCategory.sort && getByCategory.sort.by && getByCategory.sort.type) {
    sort[getByCategory.sort.by] = getByCategory.sort.type;
  }

  // Fetch products
  productList = await Product
    .find(find)
    .select("_id name slug priceOld priceNew images variants category status ratingAvg ratingCount")
    .sort(sort)
    .limit(limit)

  for(const item of productList) {
    formatProductItem(item);
  }

  return productList;
}

export const getBlogByCategory = async (getByCategory: any) => {
  let blogList: any[] = [];

  // Create find options object
  const find: any = {
    deleted: false,
    status: "published"
  };

  // Get categories IDs array
  if(getByCategory.category && getByCategory.category.length) {
    const categoryList = await CategoryBlog.find({
      slug: { $in: getByCategory.category },
      deleted: false,
      status: "active"
    }).select("_id");
    const categoryIds = categoryList.map((category: any) => category.id);
    find.category = { $in: categoryIds };
  }

  // Get article limit
  let limit = 10;
  if(getByCategory.limit) {
    limit = getByCategory.limit;
  }

  // Sort
  const sort: any = {};
  if(getByCategory.sort && getByCategory.sort.by && getByCategory.sort.type) {
    sort[getByCategory.sort.by] = getByCategory.sort.type;
  }

  // Fetch articles
  blogList = await Blog
    .find(find)
    .select("name avatar slug category createdBy updatedBy createdAt updatedAt")
    .sort(sort)
    .limit(limit)

  const adminIds = [...new Set(blogList.map((i: any) => String(i.updatedBy || i.createdBy)).filter(Boolean))];
  if (adminIds.length > 0) {
    const admins = await AccountAdmin.find({ _id: { $in: adminIds } }).select("_id fullName");
    const adminMap = new Map((admins as any[]).map((a: any) => [String(a._id), a.fullName]));
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
}