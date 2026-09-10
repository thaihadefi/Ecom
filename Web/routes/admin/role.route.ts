import { Router } from "express";
import * as roleController from "../../controllers/admin/role.controller";
import multer from "multer";
import * as roleValidate from "../../validates/admin/role.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

const upload = multer();

router.get('/create', roleController.create);

router.post(
  '/create',
  upload.none(),
  checkPermission("role-create"),
  roleValidate.createPost,
  roleController.createPost
);

router.get('/list', roleController.list);

router.get('/trash', roleController.trash);

router.get('/edit/:id', roleController.edit);

router.patch(
  '/edit/:id',
  upload.none(),
  checkPermission("role-edit"),
  roleValidate.createPost,
  roleController.editPatch
);

router.patch('/delete/:id', checkPermission("role-delete"), roleController.deletePatch);

router.patch('/delete-many', checkPermission("role-delete"), roleController.deleteManyPatch);

router.patch('/undo/:id', checkPermission("role-edit"), roleController.undoPatch);

router.patch('/change-multi', checkPermission("role-edit"), roleController.changeMultiPatch);

router.patch('/undo-many', checkPermission("role-edit"), roleController.undoManyPatch);

router.delete('/destroy/:id', checkPermission("role-delete"), roleController.destroyDelete);

router.delete('/destroy-many', checkPermission("role-delete"), roleController.destroyManyDelete);

export default router;
