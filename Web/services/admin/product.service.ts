import mongoose, { AnyBulkWriteOperation } from 'mongoose';
import Papa from 'papaparse';
import Product from '../../models/product.model';
import Review from '../../models/review.model';
import CategoryProduct from '../../models/category-product.model';
import AttributeProduct from '../../models/attribute-product.model';
import { IProduct, IProductInput, IProductSeoInput } from '../../interfaces/models/product.interface';
import { buildCategoryTree } from '../../helpers/category.helper';
import { toSearchText } from '../../helpers/slugify.helper';
import { generateRandomString, escapeRegex } from '../../helpers/generate.helper';
import { pingGoogleSitemap } from '../../helpers/ping-google.helper';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';

export const getProductList = async (rawKeyword?: unknown, rawPage?: unknown) => {
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
  const totalRecord = await Product.countDocuments(find);
  const pagination = getPagination(rawPage, limitItems, totalRecord);

  const recordList = await Product
    .find(find)
    .select("_id name slug images priceNew priceOld position stock view status")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({
      position: "desc"
    });

  return {
    recordList,
    pagination
  };
};

export const getProductCreateContext = async () => {
  const [categoryList, attributeList, productList] = await Promise.all([
    CategoryProduct.find({ deleted: false }).select("_id name slug parent status"),
    AttributeProduct.find({ deleted: false }).select("_id name type options"),
    Product.find({ deleted: false, status: "active" }).sort({ position: "desc" }).select("id name")
  ]);

  const categoryTree = buildCategoryTree(categoryList);

  return {
    categoryList: categoryTree,
    attributeList,
    productList
  };
};

export const createProduct = async (data: IProductInput): Promise<{ success: boolean; message: string; product?: IProduct }> => {
  const existSlug = await Product.findOne({
    slug: String(data.slug || "")
  }).select("_id");

  if (existSlug) {
    return { success: false, message: "Slug already exists!" };
  }

  if (data.position) {
    data.position = parseInt(String(data.position));
  } else {
    const recordMaxPosition = await Product
      .findOne({})
      .select("position")
      .sort({ position: "desc" });
    data.position = (recordMaxPosition?.position || 0) + 1;
  }

  if (typeof data.category === "string") data.category = JSON.parse(data.category);
  if (typeof data.images === "string") data.images = JSON.parse(data.images);
  if (typeof data.attributes === "string") data.attributes = JSON.parse(data.attributes);
  if (typeof data.variants === "string") data.variants = JSON.parse(data.variants);
  if (typeof data.tags === "string") data.tags = JSON.parse(data.tags);
  if (typeof data.boughtTogether === "string") data.boughtTogether = JSON.parse(data.boughtTogether);

  data.search = toSearchText(`${data.name}`);

  const priceOld = data.priceOld ? parseInt(String(data.priceOld)) : 0;
  data.priceOld = priceOld;
  if (data.priceNew) {
    const priceNew = parseInt(String(data.priceNew));
    data.priceNew = priceNew;
    data.discount = priceOld ? Math.floor(((priceOld - priceNew) / priceOld) * 100) : 0;
  } else {
    data.priceNew = priceOld;
    data.discount = 0;
  }

  if (data.stock) data.stock = parseInt(String(data.stock));
  data.sku = generateRandomString(10).toUpperCase();

  const firstImg = Array.isArray(data.images) && data.images.length > 0 ? String(data.images[0]) : "";
  const tagList = Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []);

  data.seo = {
    title: data.name,
    description: "",
    keywords: tagList,
    robots: {
      index: true,
      follow: true,
    },
    og: {
      title: data.name,
      description: "",
      image: firstImg,
    },
  };

  const newRecord = new Product(data);
  await newRecord.save();

  await pingGoogleSitemap();

  return { success: true, message: "Product created successfully!", product: newRecord };
};

export const getProductEditContext = async (id: string) => {
  const [categoryList, attributeList, productDetail] = await Promise.all([
    CategoryProduct.find({ deleted: false }).select("_id name slug parent status"),
    AttributeProduct.find({ deleted: false }).select("_id name type options"),
    Product.findOne({ _id: id, deleted: false })
  ]);

  if (!productDetail) return null;

  const categoryTree = buildCategoryTree(categoryList);

  const attributeNameList: string[] = [];
  (productDetail.attributes || []).forEach(attrId => {
    const attributeInfo = attributeList.find((item) => String(item._id) === String(attrId));
    if (attributeInfo) {
      attributeNameList.push(`${attributeInfo.name}`);
    }
  });

  const productList = await Product
    .find({
      _id: { $ne: productDetail.id },
      deleted: false,
      status: "active"
    })
    .sort({ position: "desc" })
    .select("id name");

  return {
    categoryList: categoryTree,
    attributeList,
    productDetail,
    attributeNameList,
    productList
  };
};

export const updateProduct = async (id: string, data: IProductInput): Promise<{ success: boolean; message: string; product?: IProduct | null }> => {
  const productDetail = await Product.findOne({ _id: id, deleted: false });
  if (!productDetail) {
    return { success: false, message: "Product does not exist!" };
  }

  const existSlug = await Product.findOne({
    _id: { $ne: id },
    slug: String(data.slug || "")
  }).select("_id");

  if (existSlug) {
    return { success: false, message: "Slug already exists!" };
  }

  if (data.position) {
    data.position = parseInt(String(data.position));
  } else {
    const recordMaxPosition = await Product
      .findOne({})
      .select("position")
      .sort({ position: "desc" });
    data.position = (recordMaxPosition?.position || 0) + 1;
  }

  if (typeof data.category === "string") data.category = JSON.parse(data.category);
  if (typeof data.images === "string") data.images = JSON.parse(data.images);
  if (typeof data.attributes === "string") data.attributes = JSON.parse(data.attributes);
  if (typeof data.variants === "string") data.variants = JSON.parse(data.variants);
  if (typeof data.tags === "string") data.tags = JSON.parse(data.tags);
  if (typeof data.boughtTogether === "string") data.boughtTogether = JSON.parse(data.boughtTogether);

  data.search = toSearchText(`${data.name}`);

  const priceOld = data.priceOld ? parseInt(String(data.priceOld)) : undefined;
  if (priceOld !== undefined) data.priceOld = priceOld;

  if (data.priceNew) {
    const priceNew = parseInt(String(data.priceNew));
    data.priceNew = priceNew;
    data.discount = priceOld ? Math.floor(((priceOld - priceNew) / priceOld) * 100) : 0;
  } else {
    data.priceNew = data.priceOld;
    data.discount = 0;
  }

  if (data.stock) data.stock = parseInt(String(data.stock));
  if (!productDetail.sku) {
    data.sku = generateRandomString(10).toUpperCase();
  }

  await Product.updateOne({ _id: id, deleted: false }, data);

  return { success: true, message: "Product updated successfully!", product: productDetail };
};

export const softDeleteProduct = async (id: string): Promise<{ success: boolean; message: string }> => {
  await Product.updateOne({ _id: id }, { deleted: true, deletedAt: Date.now() });
  return { success: true, message: "Product deleted successfully!" };
};

export const updateProductSEO = async (id: string, body: IProductSeoInput): Promise<{ success: boolean; message: string }> => {
  const productDetail = await Product.findOne({ _id: id, deleted: false });
  if (!productDetail) {
    return { success: false, message: "Product does not exist!" };
  }

  const seoTitle = body.seoTitle || productDetail.name;
  const seoDescription = body.seoDescription || "";
  let seoKeywords = productDetail.tags;
  if (body.seoKeywords) {
    try {
      seoKeywords = typeof body.seoKeywords === "string" ? JSON.parse(body.seoKeywords) : body.seoKeywords;
    } catch {
      seoKeywords = [String(body.seoKeywords)];
    }
  }
  const seoRobotsIndex = body.seoRobotsIndex === "true";
  const seoRobotsFollow = body.seoRobotsFollow === "true";
  const seoOgTitle = body.seoOgTitle || seoTitle;
  const seoOgDescription = body.seoOgDescription || seoDescription;
  const seoOgImage = body.seoOgImage || productDetail.images?.[0] || "";

  const seoData = {
    title: seoTitle,
    description: seoDescription,
    keywords: seoKeywords,
    robots: {
      index: seoRobotsIndex,
      follow: seoRobotsFollow,
    },
    og: {
      title: seoOgTitle,
      description: seoOgDescription,
      image: seoOgImage,
    },
  };

  await Product.updateOne({ _id: id, deleted: false }, { seo: seoData });

  return { success: true, message: "Product SEO updated successfully!" };
};

export const permanentlyDeleteProduct = async (id: string) => {
  const productId = String(id);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Product.deleteOne({ _id: productId }, { session });
      await Review.deleteMany({ productId }, { session });
    });
  } finally {
    session.endSession();
  }

  return { success: true, message: "Deleted permanently!" };
};

export const permanentlyDeleteManyProducts = async (ids: string[]) => {
  const productIds = ids.map(String);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Product.deleteMany({ _id: { $in: ids } }, { session });
      await Review.deleteMany({ productId: { $in: productIds } }, { session });
    });
  } finally {
    session.endSession();
  }

  return { success: true, message: `Deleted ${ids.length} product(s) permanently!` };
};

export const softDeleteManyProducts = async (ids: string[]) => {
  await Product.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
  return { success: true, message: `Moved ${ids.length} product(s) to trash!` };
};

export const restoreProduct = async (id: string) => {
  await Product.updateOne({ _id: id }, { deleted: false });
  return { success: true, message: "Restored successfully!" };
};

export const restoreManyProducts = async (ids: string[]) => {
  await Product.updateMany({ _id: { $in: ids } }, { deleted: false });
  return { success: true, message: `Restored ${ids.length} product(s)!` };
};

export const getProductTrash = async () => {
  return Product.find({ deleted: true }).select("_id name slug images status deletedAt").sort({ deletedAt: "desc" });
};

export const getProductsBatchForExport = async (skip: number, limit: number) => {
  return Product.find({ deleted: false }).skip(skip).limit(limit);
};

export const bulkImportProductsFromCsv = async (csvBufferString: string) => {
  const result = Papa.parse(csvBufferString, {
    header: true,
    skipEmptyLines: true
  });

  const items = result.data as Array<Record<string, unknown>>;

  const operations: AnyBulkWriteOperation<IProduct>[] = items
    .filter((item) => Boolean(item._id))
    .map((item) => {
      const position = item.position ? parseInt(String(item.position)) : 0;
      const category = item.category ? JSON.parse(String(item.category)) : [];
      const priceOld = item.priceOld ? parseInt(String(item.priceOld)) : 0;
      const priceNew = item.priceNew ? parseInt(String(item.priceNew)) : 0;
      const stock = item.stock ? parseInt(String(item.stock)) : 0;
      const attributes = item.attributes ? JSON.parse(String(item.attributes)) : [];
      const variants = item.variants ? JSON.parse(String(item.variants)) : [];
      const tags = item.tags ? JSON.parse(String(item.tags)) : [];
      const images = item.images ? JSON.parse(String(item.images)) : [];
      const search = toSearchText(`${item.name}`);
      const deleted = item.deleted == "true" || item.deleted === true;
      const deletedAt = item.deletedAt ? new Date(item.deletedAt as string) : undefined;
      const createdAt = item.createdAt ? new Date(item.createdAt as string) : undefined;
      const updatedAt = item.updatedAt ? new Date(item.updatedAt as string) : undefined;

      const updateData: Partial<IProduct> = {
        name: String(item.name || ""),
        position,
        category,
        priceOld,
        priceNew,
        stock,
        attributes,
        variants,
        tags,
        images,
        search,
        deleted,
        deletedAt,
        createdAt,
        updatedAt
      };

      return {
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(String(item._id)) },
          update: { $set: updateData }
        }
      };
    });

  if (operations.length > 0) {
    await Product.bulkWrite(operations);
  }

  return { success: true, count: operations.length };
};

export const getProductDetail = async (id: string) => {
  return Product.findOne({ _id: id, deleted: false });
};
