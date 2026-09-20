import { Router } from "express";
import * as articleController from "../../controllers/admin/article.controller";
import { textForm } from "../../helpers/upload.helper";
import * as articleValidate from "../../validates/admin/article.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

import { permanentOnly } from "../../helpers/rest.helper";
const router = Router();

const upload = textForm;

router.get('/category', checkPermission("article-category"), articleController.category);

router.get('/category/trash', checkPermission("article-category-trash"), articleController.trashCategory);

router.get('/category/create', checkPermission("article-category-create"), articleController.createCategory);

router.get('/category/edit/:id', checkPermission("article-category-edit"), articleController.editCategory);

router.get('/create', checkPermission("article-create"), articleController.create);

router.get('/list', checkPermission("article-list"), articleController.list);

router.get('/trash', checkPermission("article-trash"), articleController.trash);

router.get('/edit/:id', checkPermission("article-edit"), articleController.edit);

router.get('/edit-seo/:id', checkPermission("article-edit"), articleController.editSEO);

export default router;

export const api = Router();

api.delete('/:id', permanentOnly, checkPermission("article-delete"), articleController.destroyDelete);

api.post('/', upload.none(), checkPermission("article-create"), articleValidate.createPost, articleController.createPost);

api.patch('/:id', upload.none(), checkPermission("article-edit"), articleValidate.createPost, articleController.editPatch);

api.post('/trash', checkPermission("article-delete"), articleController.deleteManyPatch);

api.post('/:id/restore', checkPermission("article-edit"), articleController.undoPatch);

api.post('/restore', checkPermission("article-edit"), articleController.undoManyPatch);

api.delete('/', checkPermission("article-delete"), articleController.destroyManyDelete);

api.delete('/:id', checkPermission("article-delete"), articleController.deletePatch);

export const categoryApi = Router();

categoryApi.delete('/:id', permanentOnly, checkPermission("article-category-delete"), articleController.destroyCategoryDelete);

categoryApi.post('/', upload.none(), checkPermission("article-category-create"), articleValidate.createCategoryPost, articleController.createCategoryPost);

categoryApi.patch('/:id', upload.none(), checkPermission("article-category-edit"), articleValidate.createCategoryPost, articleController.editCategoryPatch);

categoryApi.post('/trash', checkPermission("article-category-delete"), articleController.deleteManyCategory);

categoryApi.post('/restore', checkPermission("article-category-edit"), articleController.undoManyCategoryPatch);

categoryApi.post('/:id/restore', checkPermission("article-category-edit"), articleController.undoCategoryPatch);

categoryApi.delete('/', checkPermission("article-category-delete"), articleController.destroyManyCategoryDelete);

categoryApi.delete('/:id', checkPermission("article-category-delete"), articleController.deleteCategoryPatch);

api.patch('/:id/seo', upload.none(), checkPermission("article-edit"), articleController.editSEOPatch);
