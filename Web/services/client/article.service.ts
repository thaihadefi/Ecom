import CategoryBlog from '../../models/category-blog.model';
import Blog from '../../models/blog.model';
import AccountAdmin from '../../models/account-admin.model';
import moment from 'moment';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { IAccountAdmin } from '../../interfaces/models/account-admin.interface';
import { IBlog } from '../../interfaces/models/blog.interface';

const populateAuthors = async (articles: IBlog[]) => {
  const adminIds = [...new Set(articles.map((i) => String(i.updatedBy || i.createdBy)).filter(Boolean))];
  const adminMap = new Map<string, string>();
  if (adminIds.length > 0) {
    const admins: Pick<IAccountAdmin, '_id' | 'fullName'>[] = await AccountAdmin.find({ _id: { $in: adminIds } }).select("_id fullName");
    for (const a of admins) adminMap.set(String(a._id), a.fullName ?? "");
  }
  for (const item of articles) {
    const id = item.updatedBy || item.createdBy;
    const name = id ? adminMap.get(String(id)) : undefined;
    if (name) {
      item.authorName = name;
      item.date = moment(item.updatedBy ? item.updatedAt : item.createdAt).format("DD/MM/YYYY");
    }
  }
};

export const getArticleList = async (page: unknown) => {
  const find = {
    status: "published",
    deleted: false
  };

  const limitItems = PAGINATION.CLIENT_LIMIT;
  const totalRecord = await Blog.countDocuments(find);
  const pagination = getPagination(page, limitItems, totalRecord);

  const articleList = await Blog
    .find(find)
    .select("name avatar slug category createdBy updatedBy createdAt updatedAt")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({ createdAt: "desc" });

  await populateAuthors(articleList);

  return {
    articleList,
    pagination
  };
};

export const getArticlesByCategory = async (slug: string, page: unknown) => {
  const categoryDetail = await CategoryBlog.findOne({
    slug: slug,
    deleted: false,
    status: "active"
  });

  if (!categoryDetail) return null;

  const find = {
    category: categoryDetail.id,
    status: "published",
    deleted: false
  };

  const limitItems = PAGINATION.CLIENT_LIMIT;
  const totalRecord = await Blog.countDocuments(find);
  const pagination = getPagination(page, limitItems, totalRecord);

  const articleList = await Blog
    .find(find)
    .select("name avatar slug category createdBy updatedBy createdAt updatedAt")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({ createdAt: "desc" });

  await populateAuthors(articleList);

  return {
    categoryDetail,
    articleList,
    pagination
  };
};

export const getArticleDetail = async (slug: string) => {
  const articleDetail = await Blog.findOne({
    slug: slug,
    deleted: false,
    status: "published"
  });

  if (!articleDetail) return null;

  if (articleDetail.updatedBy) {
    const accountInfo = await AccountAdmin.findOne({ _id: articleDetail.updatedBy }).select("_id fullName");
    if (accountInfo) {
      articleDetail.authorName = accountInfo.fullName;
      articleDetail.date = moment(articleDetail.updatedAt).format("DD/MM/YYYY");
    }
  } else if (articleDetail.createdBy) {
    const accountInfo = await AccountAdmin.findOne({ _id: articleDetail.createdBy }).select("_id fullName");
    if (accountInfo) {
      articleDetail.authorName = accountInfo.fullName;
      articleDetail.date = moment(articleDetail.createdAt).format("DD/MM/YYYY");
    }
  }

  return articleDetail;
};

export const incrementCategoryView = async (categoryId: string) => {
  await CategoryBlog.updateOne(
    { _id: categoryId, deleted: false, status: "active" },
    { $inc: { view: 1 } }
  );
};

export const incrementArticleView = async (slug: string) => {
  await Blog.updateOne(
    { slug: slug, deleted: false, status: "published" },
    { $inc: { view: 1 } }
  );
};

export const getPopularArticles = async (limit = 3): Promise<IBlog[]> => {
  const blogList = await Blog
    .find({
      deleted: false,
      status: "published"
    })
    .select("name avatar slug createdAt")
    .sort({ view: "desc" })
    .limit(limit);

  for (const item of blogList) {
    if (item.createdAt) {
      item.createdAtFormat = moment(item.createdAt).format("DD/MM/YYYY");
    }
  }

  return blogList;
};

export const getPopularCategoriesWithCount = async () => {
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

  return categories;
};
