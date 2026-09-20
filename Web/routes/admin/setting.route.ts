import { Router } from "express";
import * as settingController from "../../controllers/admin/setting.controller";
import { settingPatch } from "../../validates/admin/setting.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get('/api-shipping', checkPermission("setting-view"), settingController.apiShipping);

router.get('/api-payment', checkPermission("setting-view"), settingController.apiPayment);

router.get('/api-login-social', checkPermission("setting-view"), settingController.apiLoginSocial);

router.get('/api-app-password', checkPermission("setting-view"), settingController.apiAppPassword);

router.get('/general', checkPermission("setting-view"), settingController.general);

export default router;

export const settingApi = Router();

settingApi.patch('/shipping', checkPermission("setting-edit"), settingPatch("apiShipping"), settingController.apiShippingPatch);

settingApi.patch('/payment', checkPermission("setting-edit"), settingPatch("apiPayment"), settingController.apiPaymentPatch);

settingApi.patch('/social-login', checkPermission("setting-edit"), settingPatch("apiLoginSocial"), settingController.apiLoginSocialPatch);

settingApi.patch('/email', checkPermission("setting-edit"), settingPatch("apiAppPassword"), settingController.apiAppPasswordPatch);

settingApi.patch('/general', checkPermission("setting-edit"), settingPatch("general"), settingController.generalPatch);

export const cacheApi = Router();

cacheApi.delete('/', checkPermission("setting-edit"), settingController.removeCachePatch);
