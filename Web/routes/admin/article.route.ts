import { Router } from "express";
import * as articleController from "../../controllers/admin/article.controller";
import multer from "multer";
import * as articleValidate from "../../validates/admin/article.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

const upload = multer();

router.get('/category', articleController.category);

router.get('/category/trash', articleController.trashCategory);

router.get('/category/create', articleController.createCategory);

router.post(
  '/category/create',
  upload.none(),
  checkPermission("article-category-create"),
  articleValidate.createCategoryPost,
  articleController.createCategoryPost
);

router.get('/category/edit/:id', articleController.editCategory);

router.patch(
  '/category/edit/:id',
  upload.none(),
  checkPermission("article-category-edit"),
  articleValidate.createCategoryPost,
  articleController.editCategoryPatch
);

router.patch('/category/change-multi', checkPermission("article-category-edit"), articleController.changeMultiCategoryPatch);

router.patch('/category/delete-many', checkPermission("article-category-delete"), articleController.deleteManyCategory);

router.patch('/category/delete/:id', checkPermission("article-category-delete"), articleController.deleteCategoryPatch);

router.patch('/category/undo-many', checkPermission("article-category-edit"), articleController.undoManyCategoryPatch);

router.patch('/category/undo/:id', checkPermission("article-category-edit"), articleController.undoCategoryPatch);

router.delete('/category/destroy-many', checkPermission("article-category-delete"), articleController.destroyManyCategoryDelete);

router.delete('/category/destroy/:id', checkPermission("article-category-delete"), articleController.destroyCategoryDelete);

router.get('/create', articleController.create);

router.post(
  '/create',
  upload.none(),
  checkPermission("article-create"),
  articleValidate.createPost,
  articleController.createPost
);

router.get('/list', articleController.list);

router.get('/trash', articleController.trash);

router.get('/edit/:id', articleController.edit);

router.patch(
  '/edit/:id',
  upload.none(),
  checkPermission("article-edit"),
  articleValidate.createPost,
  articleController.editPatch
);

router.patch(
  '/edit-seo/:id',
  upload.none(),
  checkPermission("article-edit"),
  articleController.editSEOPatch
);

router.patch('/change-multi', checkPermission("article-edit"), articleController.changeMultiPatch);

router.patch('/delete-many', checkPermission("article-delete"), articleController.deleteManyPatch);

router.patch(
  '/delete/:id',
  checkPermission("article-delete"),
  articleController.deletePatch
);

router.patch('/undo/:id', checkPermission("article-edit"), articleController.undoPatch);

router.patch('/undo-many', checkPermission("article-edit"), articleController.undoManyPatch);

router.delete('/destroy/:id', checkPermission("article-delete"), articleController.destroyDelete);

router.get('/edit-seo/:id', articleController.editSEO);

router.delete('/destroy-many', checkPermission("article-delete"), articleController.destroyManyDelete);

export default router;
