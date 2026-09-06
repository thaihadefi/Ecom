import mongoose, { AnyBulkWriteOperation } from 'mongoose';
import Papa from 'papaparse';
import Product from '../../models/product.model';
import Review from '../../models/review.model';
import CategoryProduct from '../../models/category-product.model';
import AttributeProduct from '../../models/attribute-product.model';
import { IProduct, IProductInput, IProductSeoInput, IProductVariant } from '../../interfaces/models/product.interface';
import { buildCategoryTree } from '../../helpers/category.helper';
import { toSearchText } from '../../helpers/slugify.helper';
import { generateRandomString } from '../../helpers/generate.helper';
import { pingGoogleSitemap } from '../../helpers/ping-google.helper';
import { softDeleteMany, restoreMany, getTrash } from "../../helpers/admin-crud.helper";
import { paginatedSearch } from "../../helpers/list-query.helper";
import { buildSeoPayload } from "../../helpers/seo.helper";

export const getProductList = async (rawKeyword?: unknown, rawPage?: unknown) => {
  const { recordList, pagination } = await paginatedSearch(Product, rawKeyword, rawPage, { select: "_id name slug images priceNew priceOld position stock view status", sort: { position: "desc" } });

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
  if (Array.isArray(data.variants)) {
    data.variants = (data.variants as unknown as Array<Record<string, unknown>>).map((v) => {
      const pNew = v.priceNew !== undefined ? Number(v.priceNew) : (v.price !== undefined ? Number(v.price) : 0);
      const pOld = v.priceOld !== undefined ? Number(v.priceOld) : pNew;
      return {
        status: Boolean(v.status),
        attributeValue: (Array.isArray(v.attributeValue) ? v.attributeValue : []) as IProductVariant["attributeValue"],
        price: pNew,
        priceNew: pNew,
        priceOld: pOld,
        stock: v.stock !== undefined ? parseInt(String(v.stock)) : 0,
        image: v.image ? String(v.image) : undefined,
        sku: v.sku ? String(v.sku) : undefined
      };
    });
  }
  if (typeof data.tags === "string") data.tags = JSON.parse(data.tags);
  if (typeof data.boughtTogether === "string") data.boughtTogether = JSON.parse(data.boughtTogether);

  data.search = toSearchText(`${data.name}`);

  const priceOld = data.priceOld ? parseInt(String(data.priceOld)) : 0;
  const priceNew = data.priceNew ? parseInt(String(data.priceNew)) : priceOld;
  data.priceOld = priceOld;
  data.priceNew = priceNew;
  data.discount = (priceOld > 0 && priceNew > 0 && priceOld > priceNew)
    ? Number((((priceOld - priceNew) / priceOld) * 100).toFixed(2))
    : 0;

  if (data.stock !== undefined && data.stock !== "") {
    data.stock = parseInt(String(data.stock));
  }
  if (Array.isArray(data.variants) && data.variants.length > 0) {
    const totalVariantStock = data.variants.filter((v: IProductVariant) => v.status).reduce((sum: number, v: IProductVariant) => sum + (v.stock || 0), 0);
    if (data.stock === undefined || isNaN(Number(data.stock)) || Number(data.stock) === 0) {
      data.stock = totalVariantStock;
    }
  }
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
  if (Array.isArray(data.variants)) {
    data.variants = (data.variants as unknown as Array<Record<string, unknown>>).map((v) => {
      const pNew = v.priceNew !== undefined ? Number(v.priceNew) : (v.price !== undefined ? Number(v.price) : 0);
      const pOld = v.priceOld !== undefined ? Number(v.priceOld) : pNew;
      return {
        status: Boolean(v.status),
        attributeValue: (Array.isArray(v.attributeValue) ? v.attributeValue : []) as IProductVariant["attributeValue"],
        price: pNew,
        priceNew: pNew,
        priceOld: pOld,
        stock: v.stock !== undefined ? parseInt(String(v.stock)) : 0,
        image: v.image ? String(v.image) : undefined,
        sku: v.sku ? String(v.sku) : undefined
      };
    });
  }
  if (typeof data.tags === "string") data.tags = JSON.parse(data.tags);
  if (typeof data.boughtTogether === "string") data.boughtTogether = JSON.parse(data.boughtTogether);

  data.search = toSearchText(`${data.name}`);

  const priceOld = data.priceOld !== undefined ? parseInt(String(data.priceOld)) : productDetail.priceOld;
  const priceNew = data.priceNew !== undefined ? parseInt(String(data.priceNew)) : (data.priceOld ?? productDetail.priceNew);
  if (priceOld !== undefined) data.priceOld = priceOld;
  if (priceNew !== undefined) data.priceNew = priceNew;
  const pOld = typeof data.priceOld === "number" ? data.priceOld : (Number(productDetail.priceOld) || 0);
  const pNew = typeof data.priceNew === "number" ? data.priceNew : (Number(productDetail.priceNew) || 0);
  data.discount = (pOld > 0 && pNew > 0 && pOld > pNew)
    ? Number((((pOld - pNew) / pOld) * 100).toFixed(2))
    : 0;

  if (data.stock !== undefined && data.stock !== "") {
    data.stock = parseInt(String(data.stock));
  }
  if (Array.isArray(data.variants) && data.variants.length > 0) {
    const totalVariantStock = data.variants.filter((v: IProductVariant) => v.status).reduce((sum: number, v: IProductVariant) => sum + (v.stock || 0), 0);
    if (data.stock === undefined || isNaN(Number(data.stock)) || Number(data.stock) === 0) {
      data.stock = totalVariantStock;
    }
  }
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

  const seo = buildSeoPayload(body, {
    title: productDetail.name,
    keywords: productDetail.tags,
    image: productDetail.images?.[0] || "",
  });

  await Product.updateOne({ _id: id, deleted: false }, { seo });

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

export const softDeleteManyProducts = (ids: string[]) => softDeleteMany(Product, ids, "product");

export const restoreProduct = async (id: string) => {
  await Product.updateOne({ _id: id }, { deleted: false });
  return { success: true, message: "Restored successfully!" };
};

export const restoreManyProducts = (ids: string[]) => restoreMany(Product, ids, "product");

export const getProductTrash = () => getTrash(Product, "_id name slug images status deletedAt");

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
      const discount = (priceOld > 0 && priceNew > 0 && priceOld > priceNew)
        ? Number((((priceOld - priceNew) / priceOld) * 100).toFixed(2))
        : 0;
      const stock = item.stock ? parseInt(String(item.stock)) : 0;
      const attributes = item.attributes ? JSON.parse(String(item.attributes)) : [];
      const rawVariants = item.variants ? JSON.parse(String(item.variants)) : [];
      const variants = Array.isArray(rawVariants) ? rawVariants.map((v: Record<string, unknown>) => {
        const pNew = v.priceNew !== undefined ? Number(v.priceNew) : (v.price !== undefined ? Number(v.price) : 0);
        const pOld = v.priceOld !== undefined ? Number(v.priceOld) : pNew;
        return {
          status: v.status !== undefined ? Boolean(v.status) : true,
          attributeValue: (Array.isArray(v.attributeValue) ? v.attributeValue : []) as IProductVariant["attributeValue"],
          price: pNew,
          priceNew: pNew,
          priceOld: pOld,
          stock: v.stock !== undefined ? parseInt(String(v.stock)) : 0,
          image: v.image ? String(v.image) : undefined,
          sku: v.sku ? String(v.sku) : undefined
        };
      }) : [];
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
        discount,
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
