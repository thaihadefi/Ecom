import { Router } from "express";
import * as pageController from "../../controllers/client/page.controller";
import * as contactValidate from "../../validates/client/contact.validate";

const router = Router();

router.get("/about", pageController.about);
router.get("/contact", pageController.contact);
router.post("/contact", contactValidate.contactPost, pageController.contactPost);
router.get("/privacy-policy", pageController.privacyPolicy);
router.get("/terms-and-conditions", pageController.termsAndConditions);
router.get("/return-policy", pageController.returnPolicy);
router.get("/faq", pageController.faq);

export default router;
