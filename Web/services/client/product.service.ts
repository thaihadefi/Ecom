import { toSearchText } from '../../helpers/slugify.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import CategoryProduct from '../../models/category-product.model';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import Review from '../../models/review.model';
import AccountUser from '../../models/account-user.model';
import { formatProductItem } from '../../helpers/product.helper';
import { PAGINATION } from '../../configs/pagination.config';
import { PRODUCT_DISPLAY_CONFIG } from '../../configs/product-display.config';
import { getPagination } from '../../helpers/pagination.helper';
import { IAccountUser } from '../../interfaces/models/account-user.interface';
import { ICategoryProduct } from '../../interfaces/models/category-product.interface';

export interface ProductFilterQuery {
  page?: unknown;
  limitItems?: unknown;
  keyword?: unknown;
  price?: unknown;
  onSale?: unknown;
  inStock?: unknown;
  rating?: unknown;
  sort?: unknown;
  [key: string]: unknown;
}

export const getProductsByCategory = async (
  slug?: string,
  query: ProductFilterQuery = {}
) => {
  let categoryDetail: ICategoryProduct | { id: string; name: string; slug: string } | null = null;

  if (slug) {
    categoryDetail = await CategoryProduct.findOne({
      slug: slug,
      deleted: false,
      status: "active"
    });
  } else {
    categoryDetail = {
      id: "",
      name: "All Products",
      slug: ""
    };
  }

  if (!categoryDetail) return null;

  const find: Record<string, unknown> = {
    deleted: false,
    status: "active",
  };

  const categoryId = '_id' in categoryDetail && categoryDetail._id ? String(categoryDetail._id) : (categoryDetail as { id?: string }).id;
  if (categoryId) {
    find.category = categoryId;
  }

  if (query.keyword) {
    const keyword = toSearchText(`${query.keyword}`);
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }

  if (query.price) {
    const [priceMin, priceMax] = `${query.price}`.split("-").map(item => parseInt(item));
    find.priceNew = {
      $gte: priceMin,
      $lte: priceMax
    };
  }

  if (query.onSale && query.onSale === "true") {
    find.discount = { $gt: 0 };
  }

  if (query.inStock && query.inStock === "true") {
    find.stock = { $gt: 0 };
  }

  const andConditions: Record<string, unknown>[] = [];

  const attributeFilters: Record<string, unknown>[] = [];
  Object.keys(query).forEach(key => {
    if (key.startsWith("attribute_")) {
      const attrId = key.replace("attribute_", "");
      const values = `${query[key]}`.split(",");
      attributeFilters.push({
        variants: {
          $elemMatch: {
            status: true,
            attributeValue: {
              $elemMatch: {
                attrId: attrId,
                value: { $in: values }
              }
            }
          }
        }
      });
    }
  });

  if (attributeFilters.length > 0) {
    andConditions.push(...attributeFilters);
  }

  if (query.rating) {
    const ratings = `${query.rating}`
      .split(",")
      .map((r) => parseInt(r))
      .filter((r) => !isNaN(r) && r >= 1 && r <= 5);
    if (ratings.length > 0) {
      const ratingOr = ratings.map((star) => ({
        ratingAvg: {
          $gte: star,
          $lt: star + 1
        }
      }));
      andConditions.push({ $or: ratingOr });
    }
  }

  if (andConditions.length > 0) {
    find.$and = andConditions;
  }

  let limitItems = PAGINATION.CLIENT_LIMIT;
  if (query.limitItems) {
    const currentLimitItems = parseInt(`${query.limitItems}`);
    if (currentLimitItems > 0) limitItems = currentLimitItems;
  }

  const totalRecord = await Product.countDocuments(find);
  const pagination = getPagination(query.page, limitItems, totalRecord);

  const sort: Record<string, 1 | -1 | "asc" | "desc"> = {};
  if (query.sort) {
    const [sortKey, sortValue] = `${query.sort}`.split("-");
    switch (sortKey) {
      case "position":
        sort.position = sortValue as 1 | -1 | "asc" | "desc";
        break;
      case "price":
        sort.priceNew = sortValue as 1 | -1 | "asc" | "desc";
        sort.position = sortValue as 1 | -1 | "asc" | "desc";
        break;
      case "createdAt":
        sort.createdAt = sortValue as 1 | -1 | "asc" | "desc";
        break;
      case "discount":
        sort.discount = sortValue as 1 | -1 | "asc" | "desc";
        sort.position = sortValue as 1 | -1 | "asc" | "desc";
        break;
      default:
        sort.position = "desc";
        break;
    }
  } else {
    sort.position = "desc";
  }

  const categoryTopRatedFind: Record<string, unknown> = {
    deleted: false,
    status: "active",
    ratingAvg: { $gte: 4 }
  };
  if (categoryId) {
    categoryTopRatedFind.category = categoryId;
  }

  const [productList, categoryTopRated] = await Promise.all([
    Product.find(find)
      .select("_id name slug images priceNew priceOld discount variants ratingAvg ratingCount")
      .limit(limitItems)
      .skip(pagination.skip)
      .sort(sort),
    Product.find(categoryTopRatedFind)
      .select("_id name slug images priceNew priceOld discount variants ratingAvg ratingCount")
      .sort({ ratingAvg: "desc" })
      .limit(PRODUCT_DISPLAY_CONFIG.TOP_RATED_SIDEBAR_LIMIT)
  ]);

  let topRatedProducts = categoryTopRated;
  if (topRatedProducts.length === 0) {
    topRatedProducts = await Product.find({ deleted: false, status: "active", ratingAvg: { $gte: 4 } })
      .select("_id name slug images priceNew priceOld discount variants ratingAvg ratingCount")
      .sort({ ratingAvg: "desc" })
      .limit(PRODUCT_DISPLAY_CONFIG.TOP_RATED_SIDEBAR_LIMIT);
  }

  for (const item of productList) {
    formatProductItem(item);
  }
  for (const item of topRatedProducts) {
    formatProductItem(item);
  }

  return {
    categoryDetail,
    productList,
    pagination,
    topRatedProducts
  };
};

export const getProductSuggestions = async (rawKeyword?: unknown) => {
  const find: {
    status: string;
    deleted: boolean;
    priceNew: { $gt: number };
    stock: { $gt: number };
    search?: RegExp;
  } = {
    deleted: false,
    status: "active",
    priceNew: { $gt: 0 },
    stock: { $gt: 0 }
  };

  if (rawKeyword) {
    const keyword = toSearchText(`${rawKeyword}`);
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }

  return Product.find(find)
    .limit(PRODUCT_DISPLAY_CONFIG.SEARCH_SUGGESTION_LIMIT)
    .sort({ position: "desc" })
    .select("images name slug priceNew priceOld discount");
};

export const getProductDetailBySlug = async (slug: string, productViewHistory: string[] = []) => {
  const productDetail = await Product.findOne({
    slug: slug,
    deleted: false,
    status: "active"
  });

  if (!productDetail) return null;

  const attributeIds = (productDetail.attributes || []).map((a) => String(a));
  const attributeList = await AttributeProduct.find({
    _id: { $in: attributeIds }
  }).select("_id name type");

  for (const attribute of attributeList) {
    const optionMap = new Map<string, string>();
    (productDetail.variants || [])
      .filter((variant) => variant.status)
      .forEach((variant) => {
        (variant.attributeValue || []).forEach((attr) => {
          if (String(attr.attrId) === String(attribute._id) && attr.value) {
            if (!optionMap.has(attr.value)) {
              optionMap.set(attr.value, attr.label || attr.value);
            }
          }
        });
      });
    attribute.variants = Array.from(optionMap.keys());
    attribute.variantsLabel = Array.from(optionMap.values());
  }

  const categoryList = await CategoryProduct
    .find({ _id: { $in: productDetail.category }, deleted: false, status: "active" })
    .select("name slug");
  productDetail.categoryList = categoryList.map((c) => ({
    _id: c._id,
    name: c.name ?? "",
    slug: c.slug ?? ""
  }));

  const validHistory = (productViewHistory || [])
    .filter((id) => id && String(id) !== String(productDetail.id))
    .slice(0, PRODUCT_DISPLAY_CONFIG.VIEWED_PRODUCTS_LIMIT);

  const [relatedProducts, boughtTogetherProducts, viewedProductsRaw, reviewList] = await Promise.all([
    Product.find({
      _id: { $ne: productDetail.id },
      category: { $in: productDetail.category },
      deleted: false,
      status: "active"
    })
      .select("_id name slug images priceNew priceOld discount variants ratingAvg ratingCount")
      .sort({ view: "desc" })
      .limit(PRODUCT_DISPLAY_CONFIG.RELATED_PRODUCTS_LIMIT),
    Product.find({
      _id: { $in: productDetail.boughtTogether },
      deleted: false,
      status: "active"
    })
      .select("_id name slug images priceNew priceOld discount variants ratingAvg ratingCount")
      .sort({ position: "desc" })
      .limit(PRODUCT_DISPLAY_CONFIG.BOUGHT_TOGETHER_LIMIT),
    validHistory.length > 0
      ? Product.find({
          _id: { $in: validHistory },
          deleted: false,
          status: "active"
        })
          .select("_id name slug images priceNew priceOld discount variants ratingAvg ratingCount")
          .limit(PRODUCT_DISPLAY_CONFIG.VIEWED_PRODUCTS_LIMIT)
      : Promise.resolve([]),
    Review.find({ productId: productDetail.id, status: { $ne: "rejected" } })
      .select("userId rating comment images reportCount reportedBy createdAt")
      .sort({ createdAt: "desc" })
  ]);

  const viewedProducts = [...viewedProductsRaw].sort(
    (a, b) => validHistory.indexOf(String(a._id)) - validHistory.indexOf(String(b._id))
  );

  formatProductItem(productDetail);
  for (const item of relatedProducts) formatProductItem(item);
  for (const item of boughtTogetherProducts) formatProductItem(item);
  for (const item of viewedProducts) formatProductItem(item);

  const reviewUserIds = [...new Set(reviewList.map((r) => String(r.userId)).filter(Boolean))];
  if (reviewUserIds.length > 0) {
    const users: IAccountUser[] = await AccountUser.find({ _id: { $in: reviewUserIds } }).select("_id fullName avatar");
    const userMap = new Map(users.map((u: IAccountUser) => [String(u._id), u]));
    for (const item of reviewList) {
      const u = item.userId ? userMap.get(String(item.userId)) : undefined;
      if (u) item.user = { fullName: u.fullName, avatar: u.avatar };
    }
  }

  return {
    productDetail,
    attributeList,
    relatedProducts,
    boughtTogetherProducts,
    viewedProducts,
    reviewList
  };
};

export const reportReview = async (reviewId: string, userId: string) => {
  const review = await Review.findById(reviewId).select("_id reportedBy");
  if (!review) {
    return { success: false, message: "Review not found!" };
  }

  const alreadyReported = review.reportedBy?.includes(userId);
  if (alreadyReported) {
    return { success: false, message: "You have already reported this review!" };
  }

  await Review.updateOne({ _id: reviewId }, {
    $inc: { reportCount: 1 },
    $push: { reportedBy: userId }
  });

  return { success: true, message: "Review reported successfully!" };
};

export const incrementProductView = async (productId: string) => {
  await Product.updateOne(
    { _id: productId, deleted: false, status: "active" },
    { $inc: { view: 1 } }
  );
};

export const incrementCategoryProductView = async (categoryId: string) => {
  await CategoryProduct.updateOne(
    { _id: categoryId, deleted: false, status: "active" },
    { $inc: { view: 1 } }
  );
};
