import { Router } from "express";
import * as accountAdminController from "../../controllers/admin/account-admin.controller";
import multer from "multer";
import * as accountAdminValidate from "../../validates/admin/account-admin.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

const upload = multer();

router.get('/create', accountAdminController.create);

router.post(
  '/create',
  upload.none(),
  checkPermission("account-admin-create"),
  accountAdminValidate.createPost,
  accountAdminController.createPost
);

router.get('/list', accountAdminController.list);

router.get('/trash', accountAdminController.trash);

router.get('/edit/:id', accountAdminController.edit);

router.patch(
  '/edit/:id',
  upload.none(),
  checkPermission("account-admin-edit"),
  accountAdminValidate.editPatch,
  accountAdminController.editPatch
);

router.patch('/delete/:id', checkPermission("account-admin-delete"), accountAdminController.deletePatch);

router.patch('/delete-many', checkPermission("account-admin-delete"), accountAdminController.deleteManyPatch);

router.patch('/undo/:id', checkPermission("account-admin-edit"), accountAdminController.undoPatch);

router.patch('/change-multi', checkPermission("account-admin-edit"), accountAdminController.changeMultiPatch);

router.patch('/undo-many', checkPermission("account-admin-edit"), accountAdminController.undoManyPatch);

router.delete('/destroy/:id', checkPermission("account-admin-delete"), accountAdminController.destroyDelete);

router.delete('/destroy-many', checkPermission("account-admin-delete"), accountAdminController.destroyManyDelete);

router.get('/change-password/:id', accountAdminController.changePassword);

router.patch(
  '/change-password/:id',
  upload.none(),
  checkPermission("account-admin-change-password"),
  accountAdminValidate.changePasswordPatch,
  accountAdminController.changePasswordPatch
);

export default router;
