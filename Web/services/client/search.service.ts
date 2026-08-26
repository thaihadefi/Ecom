import Product from '../../models/product.model';
import Blog from '../../models/blog.model';
import { findIdsByKeyword } from '../../helpers/atlas-search.helper';
import { formatProductItem } from '../../helpers/product.helper';
import { PAGINATION } from '../../configs/pagination.config';

export const searchProductsAndArticles = async (keyword: string, rawPage: unknown) => {
  const trimmed = `${keyword || ""}`.trim();
  if (!trimmed) {
    return {
      keyword: "",
      productList: [],
      articleList: [],
      pagination: { totalPage: 0, currentPage: 1, totalRecord: 0, skip: 0 }
    };
  }

  const limitItems = PAGINATION.CLIENT_LIMIT;
  let page = 1;
  if (rawPage) {
    const currentPage = parseInt(`${rawPage}`);
    if (currentPage > 0) page = currentPage;
  }
  const skip = (page - 1) * limitItems;

  const [productIds, articleIds] = await Promise.all([
    findIdsByKeyword({ model: Product, keyword: trimmed, atlasPaths: ["name", "description"], limit: 2000 }).catch(() => [] as string[]),
    findIdsByKeyword({ model: Blog, keyword: trimmed, atlasPaths: ["name", "description", "content"], limit: 2000 }).catch(() => [] as string[]),
  ]);

  const productFind: Record<string, unknown> = {
    deleted: false,
    status: "active",
    _id: { $in: productIds }
  };

  const articleFind: Record<string, unknown> = {
    deleted: false,
    status: "published",
    _id: { $in: articleIds }
  };

  const [totalProductRecord, productList, articleList] = await Promise.all([
    Product.countDocuments(productFind),
    Product.find(productFind)
      .select("_id name slug images priceNew priceOld variants ratingAvg ratingCount")
      .limit(limitItems)
      .skip(skip)
      .sort({ createdAt: "desc" }),
    Blog.find(articleFind)
      .select("name avatar slug")
      .limit(5)
      .sort({ createdAt: "desc" }),
  ]);

  const totalPage = Math.ceil(totalProductRecord / limitItems);

  for (const item of productList) {
    formatProductItem(item);
  }

  return {
    keyword: trimmed,
    productList,
    articleList,
    pagination: {
      totalPage,
      currentPage: page,
      totalRecord: totalProductRecord,
      skip
    }
  };
};
