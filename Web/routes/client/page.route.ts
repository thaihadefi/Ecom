import { Router } from "express";
import * as pageController from "../../controllers/client/page.controller";
import * as contactValidate from "../../validates/client/contact.validate";
import { pageRateLimit, MINUTE } from "../../middlewares/rate-limit.middleware";

const router = Router();

router.get("/about", pageController.about);
router.get("/contact", pageController.contact);
router.get("/privacy-policy", pageController.privacyPolicy);
router.get("/terms-and-conditions", pageController.termsAndConditions);
router.get("/return-policy", pageController.returnPolicy);
router.get("/faq", pageController.faq);

export default router;

export const contactInquiryApi = Router();

contactInquiryApi.post('/', pageRateLimit({ windowMs: 10 * MINUTE, max: 5 }), contactValidate.contactPost, pageController.contactPost);
