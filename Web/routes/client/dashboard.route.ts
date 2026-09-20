import { Router } from "express";
import * as dashboardController from "../../controllers/client/dashboard.controller";
import * as dashboardValidate from "../../validates/client/dashboard.validate";
import { imageUpload, requireRealImages } from "../../helpers/upload.helper";
import { pageRateLimit, HOUR } from "../../middlewares/rate-limit.middleware";

const router = Router();

router.get('/', dashboardController.dashboard);

router.get('/profile', dashboardController.profile);

router.get('/profile/edit', dashboardController.profileEdit);

router.get('/change-password', dashboardController.changePassword);

router.get('/address', dashboardController.address);

router.get('/address/create', dashboardController.addressCreate);

router.get('/address/edit/:id', dashboardController.addressEdit);

router.get('/order/list', dashboardController.orderList);

router.get('/order/detail/:id', dashboardController.orderDetail);

router.get('/order/review/:id', dashboardController.orderReview);

export default router;

export const meApi = Router();

meApi.patch(
  '/',
  dashboardValidate.profileEditPatch,
  dashboardController.profileEditPatch
);

meApi.put(
  '/avatar',
  imageUpload.single("avatar"),
  requireRealImages,
  dashboardController.profileChangeAvatarPatch
);

meApi.post(
  '/email-changes',
  pageRateLimit({ windowMs: HOUR, max: 5, key: (req) => `change-email|${req.res?.locals.accountUser?.id || req.ip}` }),
  dashboardValidate.changeEmailRequest,
  dashboardController.changeEmailRequestPost
);

meApi.put(
  '/email',
  dashboardValidate.changeEmailVerify,
  dashboardController.changeEmailVerifyPost
);

meApi.post(
  '/addresses',
  dashboardValidate.addressCreatePost,
  dashboardController.addressCreatePost
);

meApi.patch(
  '/addresses/:id',
  dashboardValidate.addressCreatePost,
  dashboardController.addressEditPatch
);

meApi.put(
  '/addresses/:id/default',
  dashboardController.addressChangeDefaultPatch
);

meApi.delete(
  '/addresses/:id',
  dashboardController.addressDelete
);

export const reviewApi = Router();

reviewApi.post(
  '/',
  imageUpload.array("images"),
  requireRealImages,
  dashboardValidate.orderReviewPost,
  dashboardController.orderReviewPost
);
