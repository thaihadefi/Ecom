import { Router } from "express";
import * as productController from "../../controllers/client/product.controller";
import * as authMiddleware from "../../middlewares/client/auth.middleware";

const router = Router();

router.get('/', productController.productByCategory);

router.get('/category', (_req, res) => {
  res.redirect('/product');
});

router.get('/category/:slug', productController.productByCategory);

router.get('/suggest', productController.suggest);

router.get('/detail/:slug', productController.detail);

router.post('/review/report/:id', authMiddleware.loggedIn, productController.reportReviewPost);

export default router;
