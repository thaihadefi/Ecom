import { Router } from "express";
import * as couponController from "../../controllers/admin/coupon.controller";
import multer from "multer";
import * as couponValidate from "../../validates/admin/coupon.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

const upload = multer();

router.get('/create', couponController.create);

router.post(
  '/create',
  upload.none(),
  checkPermission("coupon-create"),
  couponValidate.createPost,
  couponController.createPost
);

router.get('/list', couponController.list);
router.get('/trash', couponController.trash);
router.get('/edit/:id', couponController.edit);

router.patch(
  '/edit/:id',
  upload.none(),
  checkPermission("coupon-edit"),
  couponValidate.createPost,
  couponController.editPatch
);

router.patch('/delete/:id', checkPermission("coupon-delete"), couponController.deletePatch);
router.patch('/delete-many', checkPermission("coupon-delete"), couponController.deleteManyPatch);
router.patch('/undo/:id', checkPermission("coupon-edit"), couponController.undoPatch);
router.patch('/change-multi', checkPermission("coupon-edit"), couponController.changeMultiPatch);
router.patch('/undo-many', checkPermission("coupon-edit"), couponController.undoManyPatch);
router.delete('/destroy/:id', checkPermission("coupon-delete"), couponController.destroyDelete);
router.delete('/destroy-many', checkPermission("coupon-delete"), couponController.destroyManyDelete);

export default router;
