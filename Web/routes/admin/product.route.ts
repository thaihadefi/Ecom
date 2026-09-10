import { Router } from "express";
import * as productController from "../../controllers/admin/product.controller";
import multer from "multer";
import * as productValidate from "../../validates/admin/product.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

const upload = multer();

router.get('/category', productController.category);
router.get('/category/trash', productController.trashCategory);
router.get('/category/create', productController.createCategory);

router.post(
  '/category/create',
  upload.none(),
  checkPermission("product-create"),
  productValidate.createCategoryPost,
  productController.createCategoryPost
);

router.get('/category/edit/:id', productController.editCategory);

router.patch(
  '/category/edit/:id',
  upload.none(),
  checkPermission("product-edit"),
  productValidate.createCategoryPost,
  productController.editCategoryPatch
);

router.patch('/category/change-multi', checkPermission("product-edit"), productController.changeMultiCategoryPatch);
router.patch('/category/delete-many', checkPermission("product-delete"), productController.deleteManyCategory);
router.patch('/category/delete/:id', checkPermission("product-delete"), productController.deleteCategoryPatch);
router.patch('/category/undo-many', checkPermission("product-edit"), productController.undoManyCategoryPatch);
router.patch('/category/undo/:id', checkPermission("product-edit"), productController.undoCategoryPatch);
router.delete('/category/destroy-many', checkPermission("product-delete"), productController.destroyManyCategoryDelete);
router.delete('/category/destroy/:id', checkPermission("product-delete"), productController.destroyCategoryDelete);

router.get('/attribute', productController.attribute);
router.get('/attribute/create', productController.createAttribute);

router.post(
  '/attribute/create',
  upload.none(),
  checkPermission("product-create"),
  productValidate.createAttributePost,
  productController.createAttributePost
);

router.get('/attribute/edit/:id', productController.editAttribute);

router.patch(
  '/attribute/edit/:id',
  upload.none(),
  checkPermission("product-edit"),
  productValidate.createAttributePost,
  productController.editAttributePatch
);

router.patch('/attribute/delete/:id', checkPermission("product-delete"), productController.deleteAttributePatch);
router.get('/attribute/trash', productController.trashAttribute);
router.patch('/attribute/undo/:id', checkPermission("product-edit"), productController.undoAttributePatch);
router.delete('/attribute/destroy/:id', checkPermission("product-delete"), productController.destroyAttributeDelete);

router.get('/create', productController.create);

router.post(
  '/create',
  upload.none(),
  checkPermission("product-create"),
  productValidate.createPost,
  productController.createPost
);

router.get('/list', productController.list);
router.get('/trash', productController.trash);
router.get('/edit/:id', productController.edit);

router.patch(
  '/edit/:id',
  upload.none(),
  checkPermission("product-edit"),
  productValidate.createPost,
  productController.editPatch
);

router.get('/edit-seo/:id', productController.editSEO);

router.patch(
  '/edit-seo/:id',
  upload.none(),
  checkPermission("product-edit"),
  productValidate.editSEOPatch,
  productController.editSEOPatch
);

router.patch('/delete/:id', checkPermission("product-delete"), productController.deletePatch);
router.patch('/change-multi', checkPermission("product-edit"), productController.changeMultiPatch);
router.patch('/delete-many', checkPermission("product-delete"), productController.deleteManyPatch);
router.patch('/undo/:id', checkPermission("product-edit"), productController.undoPatch);
router.patch('/undo-many', checkPermission("product-edit"), productController.undoManyPatch);
router.delete('/destroy/:id', checkPermission("product-delete"), productController.destroyDelete);
router.delete('/destroy-many', checkPermission("product-delete"), productController.destroyManyDelete);

router.get('/export/csv', productController.exportCSV);

router.post(
  '/import/csv',
  upload.single("file"),
  checkPermission("product-create"),
  productValidate.importCSVPost,
  productController.importCSVPost
);

export default router;
