import Blog from '../../models/blog.model';
import { FEATURES } from '../../configs/features.config';
import { findIdsByKeyword } from '../../helpers/atlas-search.helper';
import { getPagination } from '../../helpers/pagination.helper';
import { populateAuthors } from './article.service';
import { getProductsByCategory, ProductFilterQuery, sortByIdOrder } from './product.service';
import { IProduct } from '../../interfaces/models/product.interface';
import { IBlog } from '../../interfaces/models/blog.interface';

const ARTICLE_RESULT_LIMIT = 5;

export interface SearchServiceResult {
  keyword: string;
  productList: IProduct[];
  articleList: IBlog[];
  topRatedProducts: IProduct[];
  pagination: ReturnType<typeof getPagination>;
}

const searchArticles = async (keyword: string): Promise<IBlog[]> => {
  if (!FEATURES.BLOG) return [];
  const rankedIds = await findIdsByKeyword({ model: Blog, keyword, atlasPaths: ["name", "description", "content"], limit: 200 })
    .catch(() => [] as string[]);
  const visible = await Blog.find({ _id: { $in: rankedIds }, deleted: false, status: "published" }).select("_id");
  const visibleIds = new Set(visible.map((doc) => String(doc._id)));
  const pageIds = rankedIds.filter((id) => visibleIds.has(id)).slice(0, ARTICLE_RESULT_LIMIT);

  const articleList = sortByIdOrder(
    await Blog.find({ _id: { $in: pageIds } }).select("name avatar slug createdBy updatedBy createdAt updatedAt"),
    pageIds
  );
  await populateAuthors(articleList);
  return articleList;
};

// Products come from the shop listing with the keyword applied, so the results page gets the same
// filters, sorts and paging as a category page, ordered by relevance by default.
export const searchProductsAndArticles = async (rawKeyword: unknown, query: ProductFilterQuery): Promise<SearchServiceResult> => {
  const keyword = `${rawKeyword || ""}`.trim().slice(0, 100);
  if (!keyword) {
    return {
      keyword: "",
      productList: [],
      articleList: [],
      topRatedProducts: [],
      pagination: getPagination(1, 1, 0)
    };
  }

  const [products, articleList] = await Promise.all([
    getProductsByCategory(undefined, { ...query, keyword }),
    // Articles are a side panel on the first page only, like a marketplace's content strip.
    query.page && `${query.page}` !== "1" ? Promise.resolve([] as IBlog[]) : searchArticles(keyword),
  ]);

  return {
    keyword,
    productList: products?.productList ?? [],
    articleList,
    topRatedProducts: products?.topRatedProducts ?? [],
    pagination: products?.pagination ?? getPagination(1, 1, 0)
  };
};
