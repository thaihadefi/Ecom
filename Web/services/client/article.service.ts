import { formatDate } from "../../helpers/format.helper";
import CategoryBlog from '../../models/category-blog.model';
import Blog from '../../models/blog.model';
import AccountAdmin from '../../models/account-admin.model';
import { PAGINATION } from '../../configs/pagination.config';
import { PRODUCT_DISPLAY_CONFIG } from '../../configs/product-display.config';
import { getPagination } from '../../helpers/pagination.helper';
import { IAccountAdmin } from '../../interfaces/models/account-admin.interface';
import { IBlog } from '../../interfaces/models/blog.interface';
import { metadataCache } from '../../helpers/metadata-cache.helper';

const DAY_MS = 24 * 60 * 60 * 1000;

// Byline and dates for every surface that shows an article (cards, detail page, Markdown copy, JSON-LD):
// the article's own author, else the staff member who created it, so later edits never take over the byline.
// date is when it was published; updatedDate is set only when it changed at least a day after that.
export const populateAuthors = async (articles: Array<Pick<IBlog, "author" | "createdBy" | "createdAt" | "updatedAt" | "publishAt" | "authorName" | "date" | "updatedDate">>) => {
  const adminIds = [...new Set(articles.filter((i) => !i.author && i.createdBy).map((i) => String(i.createdBy)))];
  const adminMap = new Map<string, string>();
  if (adminIds.length > 0) {
    const admins: Pick<IAccountAdmin, '_id' | 'fullName'>[] = await AccountAdmin.find({ _id: { $in: adminIds } }).select("_id fullName");
    for (const a of admins) adminMap.set(String(a._id), a.fullName ?? "");
  }
  for (const item of articles) {
    item.authorName = item.author || (item.createdBy ? adminMap.get(String(item.createdBy)) : "") || "";
    const published = new Date(item.publishAt || item.createdAt);
    item.date = formatDate(published);
    item.updatedDate = item.updatedAt && new Date(item.updatedAt).getTime() - published.getTime() >= DAY_MS
      ? formatDate(item.updatedAt)
      : "";
  }
};

export const getArticleList = async (page: unknown) => {
  const pageNum = page ? parseInt(String(page)) || 1 : 1;
  const listCacheKey = `article:list:p${pageNum}`;
  const cachedList = metadataCache.get<{ articleList: IBlog[]; pagination: ReturnType<typeof getPagination> }>(listCacheKey);
  if (cachedList) return cachedList;

  const find = {
    status: "published" as const,
    deleted: false
  };

  const limitItems = PAGINATION.CLIENT_LIMIT;
  const totalRecord = await Blog.countDocuments(find);
  const pagination = getPagination(page, limitItems, totalRecord);

  const articleList = await Blog
    .find(find)
    .select("name avatar slug category author createdBy createdAt updatedAt publishAt")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({ createdAt: "desc" });

  await populateAuthors(articleList);

  const result = {
    articleList,
    pagination
  };
  metadataCache.set(listCacheKey, result, 120);

  return result;
};

export const getArticlesByCategory = async (slug: string, page: unknown) => {
  const pageNum = page ? parseInt(String(page)) || 1 : 1;
  const catArticlesCacheKey = `article:cat:${slug}:p${pageNum}`;
  const cachedCat = metadataCache.get<{ categoryDetail: unknown; articleList: IBlog[]; pagination: ReturnType<typeof getPagination> }>(catArticlesCacheKey);
  if (cachedCat) return cachedCat;

  const categoryCacheKey = `category_blog:slug:${slug}`;
  let categoryDetail = metadataCache.get<typeof CategoryBlog.prototype>(categoryCacheKey);
  if (!categoryDetail) {
    categoryDetail = await CategoryBlog.findOne({
      slug: slug,
      deleted: false,
      status: "active"
    });
    if (categoryDetail) {
      metadataCache.set(categoryCacheKey, categoryDetail, 600);
    }
  }

  if (!categoryDetail) return null;

  const find = {
    category: categoryDetail.id,
    status: "published" as const,
    deleted: false
  };

  const limitItems = PAGINATION.CLIENT_LIMIT;
  const totalRecord = await Blog.countDocuments(find);
  const pagination = getPagination(page, limitItems, totalRecord);

  const articleList = await Blog
    .find(find)
    .select("name avatar slug category author createdBy createdAt updatedAt publishAt")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({ createdAt: "desc" });

  await populateAuthors(articleList);

  const result = {
    categoryDetail,
    articleList,
    pagination
  };
  metadataCache.set(catArticlesCacheKey, result, 120);

  return result;
};

export const getArticleDetail = async (slug: string) => {
  const detailCacheKey = `article:detail:${slug}`;
  const cached = metadataCache.get<IBlog>(detailCacheKey);
  if (cached) return cached;

  const articleDoc = await Blog.findOne({
    slug: slug,
    deleted: false,
    status: "published"
  });

  if (!articleDoc) return null;

  const articleDetail = articleDoc.toObject({ virtuals: true }) as unknown as IBlog;

  await populateAuthors([articleDetail]);

  metadataCache.set(detailCacheKey, articleDetail, 120);
  return articleDetail;
};


export const getArticleIdBySlug = async (slug: string): Promise<string | null> => {
  const article = await Blog.findOne({ slug, deleted: false, status: "published" }).select("_id");
  return article ? String(article._id) : null;
};

export const getCategoryIdBySlug = async (slug: string): Promise<string | null> => {
  const category = await CategoryBlog.findOne({ slug, deleted: false, status: "active" }).select("_id");
  return category ? String(category._id) : null;
};

export const incrementCategoryView = async (categoryId: string) => {
  await CategoryBlog.updateOne(
    { _id: categoryId, deleted: false, status: "active" },
    { $inc: { view: 1 } },
    // A view is not an edit: updatedAt feeds "last updated" dates, the sitemap and structured data.
    { timestamps: false }
  );
};

export const incrementArticleView = async (slug: string) => {
  await Blog.updateOne(
    { slug: slug, deleted: false, status: "published" },
    { $inc: { view: 1 } },
    // A view is not an edit: updatedAt feeds "last updated" dates, the sitemap and structured data.
    { timestamps: false }
  );
};

export const getPopularArticles = async (limit: number = PRODUCT_DISPLAY_CONFIG.POPULAR_ARTICLES_LIMIT): Promise<IBlog[]> => {
  const cacheKey = `article:popular:${limit}`;
  const cached = metadataCache.get<IBlog[]>(cacheKey);
  if (cached) return cached;

  const blogList = await Blog
    .find({
      deleted: false,
      status: "published"
    })
    .select("name avatar slug createdAt publishAt")
    .sort({ view: "desc" })
    .limit(limit);

  for (const item of blogList) {
    item.createdAtFormat = formatDate(item.publishAt || item.createdAt);
  }

  metadataCache.set(cacheKey, blogList, 300);
  return blogList;
};

export const getPopularCategoriesWithCount = async () => {
  const cacheKey = "article:popular_categories";
  const cached = metadataCache.get<Array<{ _id: unknown; name?: string | null; slug?: string | null; totalRecord?: number }>>(cacheKey);
  if (cached) return cached;

  const categoryRecords = await CategoryBlog.find({
    deleted: false,
    status: "active"
  }).select("_id name slug");

  const categories: Array<{ _id: unknown; name?: string | null; slug?: string | null; totalRecord?: number }> = categoryRecords.map((c) => ({
    _id: c._id,
    name: c.name,
    slug: c.slug
  }));

  const categoryIds = categories.map(item => String(item._id));

  const counts = await Blog.aggregate([
    {
      $match: {
        category: { $in: categoryIds },
        deleted: false,
        status: "published"
      }
    },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 }
      }
    }
  ]);

  const countMap: { [key: string]: number } = {};
  counts.forEach(item => {
    countMap[item._id] = item.count;
  });

  for (const item of categories) {
    item.totalRecord = countMap[String(item._id)] || 0;
  }

  metadataCache.set(cacheKey, categories, 300);
  return categories;
};

