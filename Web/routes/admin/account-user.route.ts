import { Router } from "express";
import * as accountUserController from "../../controllers/admin/account-user.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get('/list', checkPermission("account-user-list"), accountUserController.list);

router.patch('/delete/:id', checkPermission("account-user-delete"), accountUserController.deletePatch);

router.patch('/delete-many', checkPermission("account-user-delete"), accountUserController.deleteManyPatch);

router.get('/trash', checkPermission("account-user-list"), accountUserController.trash);

router.patch('/undo/:id', checkPermission("account-user-edit"), accountUserController.undoPatch);

router.patch('/change-multi', checkPermission("account-user-edit"), accountUserController.changeMultiPatch);

router.patch('/undo-many', checkPermission("account-user-edit"), accountUserController.undoManyPatch);

router.delete('/destroy/:id', checkPermission("account-user-delete"), accountUserController.destroyDelete);

router.delete('/destroy-many', checkPermission("account-user-delete"), accountUserController.destroyManyDelete);

export default router;
