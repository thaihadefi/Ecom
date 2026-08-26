import { Router } from "express";
import * as templateController from "../../controllers/admin/template.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get('/list', checkPermission("template-list"), templateController.list);

router.get('/create', checkPermission("template-create"), templateController.create);

router.post('/create', checkPermission("template-create"), templateController.createPost);

router.get('/edit/:id', checkPermission("template-edit"), templateController.edit);

router.patch('/edit/:id', checkPermission("template-edit"), templateController.editPatch);

router.delete('/delete/:id', checkPermission("template-delete"), templateController.deletePatch);

export default router;
