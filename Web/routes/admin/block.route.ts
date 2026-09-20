import { Router } from "express";
import * as blockController from "../../controllers/admin/block.controller";
import * as blockValidate from "../../validates/admin/block.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get('/list', checkPermission("block-list"), blockController.list);

router.get('/create', checkPermission("block-create"), blockController.create);

router.get('/edit/:id', checkPermission("block-edit"), blockController.edit);

export default router;

export const api = Router();

api.post('/', checkPermission("block-create"), blockValidate.blockPost, blockController.createPost);

api.patch('/:id', checkPermission("block-edit"), blockValidate.blockPost, blockController.editPatch);

api.delete('/:id', checkPermission("block-delete"), blockController.deletePatch);
