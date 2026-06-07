import { Router } from "express";
import * as settingController from "../../controllers/admin/setting.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get('/api-shipping', checkPermission("setting-view"), settingController.apiShipping);

router.patch('/api-shipping', checkPermission("setting-edit"), settingController.apiShippingPatch);

router.get('/api-payment', checkPermission("setting-view"), settingController.apiPayment);

router.patch('/api-payment', checkPermission("setting-edit"), settingController.apiPaymentPatch);

router.get('/api-login-social', checkPermission("setting-view"), settingController.apiLoginSocial);

router.patch('/api-login-social', checkPermission("setting-edit"), settingController.apiLoginSocialPatch);

router.get('/api-app-password', checkPermission("setting-view"), settingController.apiAppPassword);

router.patch('/api-app-password', checkPermission("setting-edit"), settingController.apiAppPasswordPatch);

router.get('/general', checkPermission("setting-view"), settingController.general);

router.patch('/general', checkPermission("setting-edit"), settingController.generalPatch);

router.patch('/remove-cache', checkPermission("setting-edit"), settingController.removeCachePatch);

export default router;