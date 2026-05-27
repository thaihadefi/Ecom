import { Request, Response } from 'express';
import Product from '../../models/product.model';
import Blog from '../../models/blog.model';
import { findIdsByKeyword } from '../../helpers/atlas-search.helper';
import { formatProductItem } from '../../helpers/product.helper';
import { PAGINATION } from '../../configs/pagination.config';

export const search = async (req: Request, res: Response) => {
  const keyword = `${req.query.keyword || ""}`.trim();

  if(!keyword) {
    res.render("client/pages/search-results", {
      pageTitle: "Search Results",
      keyword: "",
      productList: [],
      articleList: [],
      pagination: { totalPage: 0, currentPage: 1, totalRecord: 0, skip: 0 }
    });
    return;
  }

  const limitItems = PAGINATION.CLIENT_LIMIT;
  let page = 1;
  if(req.query.page) {
    const currentPage = parseInt(`${req.query.page}`);
    if(currentPage > 0) {
      page = currentPage;
    }
  }
  const skip = (page - 1) * limitItems;

  // Search products and articles in parallel using Atlas Search
  const [productIds, articleIds] = await Promise.all([
    findIdsByKeyword({ model: Product, keyword, atlasPaths: ["name", "description"], limit: 2000 }).catch(() => [] as string[]),
    findIdsByKeyword({ model: Blog, keyword, atlasPaths: ["name", "description", "content"], limit: 2000 }).catch(() => [] as string[]),
  ]);

  const productFind: any = {
    deleted: false,
    status: "active",
    _id: { $in: productIds }
  };

  const articleFind: any = {
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
      .sort({ createdAt: "desc" })
,
    Blog.find(articleFind)
      .select("name avatar slug")
      .limit(5)
      .sort({ createdAt: "desc" })
,
  ]);

  const totalPage = Math.ceil(totalProductRecord / limitItems);

  for (const item of productList) {
    formatProductItem(item as any);
  }

  res.render("client/pages/search-results", {
    pageTitle: `Search: "${keyword}"`,
    keyword,
    productList: productList,
    articleList: articleList,
    pagination: {
      totalPage,
      currentPage: page,
      totalRecord: totalProductRecord,
      skip
    }
  });
}
