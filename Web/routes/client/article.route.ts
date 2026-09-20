import { Router } from "express";
import * as articleController from "../../controllers/client/article.controller";
import { getPopularBlog, getPopularCategoryBlog } from "../../middlewares/client/article.middleware";
import { pageRateLimit, MINUTE } from "../../middlewares/rate-limit.middleware";

const router = Router();

router.get(
  '/',
  getPopularBlog,
  getPopularCategoryBlog,
  articleController.articleList
);

router.get(
  '/category/:slug',
  getPopularBlog,
  getPopularCategoryBlog,
  articleController.articleByCategory
);

router.get(
  '/detail/:slug',
  getPopularBlog,
  getPopularCategoryBlog,
  articleController.detail
);

export default router;

const viewLimit = pageRateLimit({ windowMs: MINUTE, max: 120 });

export const articleApi = Router();

articleApi.post('/:slug/views', viewLimit, articleController.detailView);

export const articleCategoryApi = Router();

articleCategoryApi.post('/:slug/views', viewLimit, articleController.categoryView);
