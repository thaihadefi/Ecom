import { Router } from "express";
import * as couponController from "../../controllers/admin/coupon.controller";
import { textForm } from "../../helpers/upload.helper";
import * as couponValidate from "../../validates/admin/coupon.validate";
import { checkAnyPermission, checkPermission } from "../../middlewares/admin/auth.middleware";

import { permanentOnly } from "../../helpers/rest.helper";
const router = Router();

const upload = textForm;

router.get('/create', checkAnyPermission("coupon-create", "coupon-edit", "coupon-delete"), couponController.create);

router.get('/list', checkAnyPermission("coupon-create", "coupon-edit", "coupon-delete"), couponController.list);
router.get('/trash', checkAnyPermission("coupon-create", "coupon-edit", "coupon-delete"), couponController.trash);
router.get('/edit/:id', checkAnyPermission("coupon-create", "coupon-edit", "coupon-delete"), couponController.edit);

export default router;

export const api = Router();

api.delete('/:id', permanentOnly, checkPermission("coupon-delete"), couponController.destroyDelete);

api.post('/', upload.none(), checkPermission("coupon-create"), couponValidate.createPost, couponController.createPost);

api.patch('/:id', upload.none(), checkPermission("coupon-edit"), couponValidate.createPost, couponController.editPatch);

api.post('/trash', checkPermission("coupon-delete"), couponController.deleteManyPatch);

api.post('/:id/restore', checkPermission("coupon-edit"), couponController.undoPatch);

api.post('/restore', checkPermission("coupon-edit"), couponController.undoManyPatch);

api.delete('/', checkPermission("coupon-delete"), couponController.destroyManyDelete);

api.delete('/:id', checkPermission("coupon-delete"), couponController.deletePatch);
