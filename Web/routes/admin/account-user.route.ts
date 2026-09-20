import { Router } from "express";
import * as accountUserController from "../../controllers/admin/account-user.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

import { permanentOnly } from "../../helpers/rest.helper";
const router = Router();

router.get('/list', checkPermission("account-user-list"), accountUserController.list);

router.get('/trash', checkPermission("account-user-list"), accountUserController.trash);

export default router;

export const api = Router();

api.delete('/:id', permanentOnly, checkPermission("account-user-delete"), accountUserController.destroyDelete);

api.post('/trash', checkPermission("account-user-delete"), accountUserController.deleteManyPatch);

api.post('/:id/restore', checkPermission("account-user-edit"), accountUserController.undoPatch);

api.post('/restore', checkPermission("account-user-edit"), accountUserController.undoManyPatch);

api.delete('/', checkPermission("account-user-delete"), accountUserController.destroyManyDelete);

api.delete('/:id', checkPermission("account-user-delete"), accountUserController.deletePatch);
