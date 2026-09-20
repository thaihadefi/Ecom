import { Router } from "express";
import * as productController from "../../controllers/client/product.controller";
import * as authMiddleware from "../../middlewares/client/auth.middleware";
import { pageRateLimit, MINUTE } from "../../middlewares/rate-limit.middleware";

const router = Router();

router.get('/', productController.productByCategory);

router.get('/category', (_req, res) => {
  res.redirect('/product');
});

router.get('/category/:slug', productController.productByCategory);

router.get('/detail/:slug', productController.detail);

export default router;

const viewLimit = pageRateLimit({ windowMs: MINUTE, max: 120 });

export const productApi = Router();

productApi.post('/:slug/views', viewLimit, productController.detailView);

export const productCategoryApi = Router();

productCategoryApi.post('/:slug/views', viewLimit, productController.categoryView);

export const productSuggestionApi = Router();

productSuggestionApi.get('/', productController.suggest);

export const reviewReportApi = Router({ mergeParams: true });

reviewReportApi.post('/', authMiddleware.loggedIn, productController.reportReviewPost);
