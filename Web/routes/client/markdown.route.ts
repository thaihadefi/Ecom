import { Router } from "express";
import * as markdownController from "../../controllers/client/markdown.controller";
import { requireFeature } from "../../middlewares/feature.middleware";
import { CONTENT_PAGES } from "../../configs/content-pages.config";

const router = Router();

const contentPagePattern = new RegExp(`^/(${CONTENT_PAGES.map((p) => p.path.slice(1)).join("|")})\\.md$`);

router.get("/llms.txt", markdownController.llms);
router.get("/llms-full.txt", markdownController.llmsFull);
router.get("/index.md", markdownController.home);
router.get("/contact.md", markdownController.contact);
router.get("/product.md", markdownController.productList);
router.get(/^\/product\/category\/([^/]+)\.md$/, markdownController.productList);
router.get(/^\/product\/detail\/([^/]+)\.md$/, markdownController.product);
router.get("/article.md", requireFeature("BLOG"), markdownController.articleList);
router.get(/^\/article\/category\/([^/]+)\.md$/, requireFeature("BLOG"), markdownController.articleList);
router.get(/^\/article\/detail\/([^/]+)\.md$/, requireFeature("BLOG"), markdownController.article);
router.get(contentPagePattern, markdownController.contentPage);

export default router;
