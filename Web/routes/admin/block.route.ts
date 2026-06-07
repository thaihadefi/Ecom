import { Router } from "express";
import * as blockController from "../../controllers/admin/block.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get('/list', checkPermission("block-list"), blockController.list);

router.get('/create', checkPermission("block-create"), blockController.create);

router.post('/create', checkPermission("block-create"), blockController.createPost);

router.get('/edit/:id', checkPermission("block-edit"), blockController.edit);

router.patch('/edit/:id', checkPermission("block-edit"), blockController.editPatch);

router.delete('/delete/:id', checkPermission("block-delete"), blockController.deletePatch);

export default router;