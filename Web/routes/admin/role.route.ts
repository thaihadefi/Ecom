import { Router } from "express";
import * as roleController from "../../controllers/admin/role.controller";
import { textForm } from "../../helpers/upload.helper";
import * as roleValidate from "../../validates/admin/role.validate";
import { guardRolePermissions, guardRoleTargets } from "../../middlewares/admin/rbac-guard.middleware";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

import { permanentOnly } from "../../helpers/rest.helper";
const router = Router();

const upload = textForm;

router.get('/create', checkPermission("role-create"), roleController.create);

router.get('/list', checkPermission("role-list"), roleController.list);

router.get('/trash', checkPermission("role-trash"), roleController.trash);

router.get('/edit/:id', checkPermission("role-edit"), roleController.edit);

export default router;

export const api = Router();

api.delete('/:id', permanentOnly, checkPermission("role-delete"), guardRoleTargets, roleController.destroyDelete);

api.post('/', upload.none(), checkPermission("role-create"), roleValidate.createPost, guardRolePermissions, roleController.createPost);

api.patch('/:id', upload.none(), checkPermission("role-edit"), roleValidate.createPost, guardRolePermissions, roleController.editPatch);

api.post('/trash', checkPermission("role-delete"), guardRoleTargets, roleController.deleteManyPatch);

api.post('/:id/restore', checkPermission("role-edit"), guardRoleTargets, roleController.undoPatch);

api.post('/restore', checkPermission("role-edit"), guardRoleTargets, roleController.undoManyPatch);

api.delete('/', checkPermission("role-delete"), guardRoleTargets, roleController.destroyManyDelete);

api.delete('/:id', checkPermission("role-delete"), guardRoleTargets, roleController.deletePatch);
