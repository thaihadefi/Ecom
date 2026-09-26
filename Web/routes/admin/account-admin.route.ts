import { Router } from "express";
import * as accountAdminController from "../../controllers/admin/account-admin.controller";
import { textForm } from "../../helpers/upload.helper";
import * as accountAdminValidate from "../../validates/admin/account-admin.validate";
import { checkAnyPermission, checkPermission } from "../../middlewares/admin/auth.middleware";
import { guardAdminTargets } from "../../middlewares/admin/rbac-guard.middleware";
import { pageRateLimit, MINUTE } from "../../middlewares/rate-limit.middleware";

import { permanentOnly } from "../../helpers/rest.helper";
const router = Router();

const upload = textForm;

router.get('/create', checkPermission("account-admin-create"), accountAdminController.create);

router.get('/list', checkPermission("account-admin-list"), accountAdminController.list);

router.get('/trash', checkAnyPermission("account-admin-edit", "account-admin-delete"), accountAdminController.trash);

router.get('/edit/:id', checkPermission("account-admin-edit"), accountAdminController.edit);

router.get('/change-password/:id', checkPermission("account-admin-change-password"), accountAdminController.changePassword);

export default router;

export const api = Router();

api.delete('/:id', permanentOnly, checkPermission("account-admin-delete"), guardAdminTargets, accountAdminController.destroyDelete);

api.post('/', upload.none(), checkPermission("account-admin-create"), accountAdminValidate.createPost, accountAdminController.createPost);

api.patch('/:id', upload.none(), checkPermission("account-admin-edit"), guardAdminTargets, accountAdminValidate.editPatch, accountAdminController.editPatch);

api.post('/trash', checkPermission("account-admin-delete"), guardAdminTargets, accountAdminController.deleteManyPatch);

api.post('/:id/restore', checkPermission("account-admin-edit"), guardAdminTargets, accountAdminController.undoPatch);

api.post('/restore', checkPermission("account-admin-edit"), guardAdminTargets, accountAdminController.undoManyPatch);

api.delete('/', checkPermission("account-admin-delete"), guardAdminTargets, accountAdminController.destroyManyDelete);

api.delete('/:id', checkPermission("account-admin-delete"), guardAdminTargets, accountAdminController.deletePatch);

api.put('/:id/password', upload.none(), checkPermission("account-admin-change-password"), guardAdminTargets, pageRateLimit({ windowMs: 15 * MINUTE, max: 5, key: (req) => req.res?.locals.accountAdmin?.id || req.ip }), accountAdminValidate.changePasswordPatch, accountAdminController.changePasswordPatch);
