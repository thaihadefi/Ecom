import { Router } from "express";
import * as templateController from "../../controllers/admin/template.controller";
import * as templateValidate from "../../validates/admin/template.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get('/list', checkPermission("template-list"), templateController.list);

router.get('/create', checkPermission("template-create"), templateController.create);

router.get('/edit/:id', checkPermission("template-edit"), templateController.edit);

export default router;

export const api = Router();

api.post('/', checkPermission("template-create"), templateValidate.templatePost, templateController.createPost);

api.patch('/:id', checkPermission("template-edit"), templateValidate.templatePost, templateController.editPatch);

api.delete('/:id', checkPermission("template-delete"), templateController.deletePatch);
