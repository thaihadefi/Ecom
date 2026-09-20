import { Router } from "express";
import * as productController from "../../controllers/admin/product.controller";
import { csvUpload, textForm } from "../../helpers/upload.helper";
import * as productValidate from "../../validates/admin/product.validate";
import { checkAnyPermission, checkPermission } from "../../middlewares/admin/auth.middleware";

import { permanentOnly } from "../../helpers/rest.helper";
const router = Router();

const upload = textForm;

router.get('/category', checkAnyPermission("product-create", "product-edit", "product-delete"), productController.category);
router.get('/category/trash', checkAnyPermission("product-create", "product-edit", "product-delete"), productController.trashCategory);
router.get('/category/create', checkAnyPermission("product-create", "product-edit", "product-delete"), productController.createCategory);

router.get('/category/edit/:id', checkAnyPermission("product-create", "product-edit", "product-delete"), productController.editCategory);

router.get('/attribute', checkAnyPermission("product-create", "product-edit", "product-delete"), productController.attribute);
router.get('/attribute/create', checkAnyPermission("product-create", "product-edit", "product-delete"), productController.createAttribute);

router.get('/attribute/edit/:id', checkAnyPermission("product-create", "product-edit", "product-delete"), productController.editAttribute);
router.get('/attribute/trash', checkAnyPermission("product-create", "product-edit", "product-delete"), productController.trashAttribute);

router.get('/create', checkAnyPermission("product-create", "product-edit", "product-delete"), productController.create);

router.get('/list', checkAnyPermission("product-create", "product-edit", "product-delete"), productController.list);
router.get('/trash', checkAnyPermission("product-create", "product-edit", "product-delete"), productController.trash);
router.get('/edit/:id', checkAnyPermission("product-create", "product-edit", "product-delete"), productController.edit);

router.get('/edit-seo/:id', checkAnyPermission("product-create", "product-edit", "product-delete"), productController.editSEO);

export default router;

export const api = Router();

api.delete('/:id', permanentOnly, checkPermission("product-delete"), productController.destroyDelete);

api.post('/', upload.none(), checkPermission("product-create"), productValidate.createPost, productController.createPost);

api.patch('/:id', upload.none(), checkPermission("product-edit"), productValidate.createPost, productController.editPatch);

api.post('/trash', checkPermission("product-delete"), productController.deleteManyPatch);

api.post('/:id/restore', checkPermission("product-edit"), productController.undoPatch);

api.post('/restore', checkPermission("product-edit"), productController.undoManyPatch);

api.delete('/', checkPermission("product-delete"), productController.destroyManyDelete);

api.delete('/:id', checkPermission("product-delete"), productController.deletePatch);

export const categoryApi = Router();

categoryApi.delete('/:id', permanentOnly, checkPermission("product-delete"), productController.destroyCategoryDelete);

categoryApi.post('/', upload.none(), checkPermission("product-create"), productValidate.createCategoryPost, productController.createCategoryPost);

categoryApi.patch('/:id', upload.none(), checkPermission("product-edit"), productValidate.createCategoryPost, productController.editCategoryPatch);

categoryApi.post('/trash', checkPermission("product-delete"), productController.deleteManyCategory);

categoryApi.post('/restore', checkPermission("product-edit"), productController.undoManyCategoryPatch);

categoryApi.post('/:id/restore', checkPermission("product-edit"), productController.undoCategoryPatch);

categoryApi.delete('/', checkPermission("product-delete"), productController.destroyManyCategoryDelete);

categoryApi.delete('/:id', checkPermission("product-delete"), productController.deleteCategoryPatch);

export const attributeApi = Router();

attributeApi.delete('/:id', permanentOnly, checkPermission("product-delete"), productController.destroyAttributeDelete);

attributeApi.post('/', upload.none(), checkPermission("product-create"), productValidate.createAttributePost, productController.createAttributePost);

attributeApi.patch('/:id', upload.none(), checkPermission("product-edit"), productValidate.createAttributePost, productController.editAttributePatch);

attributeApi.post('/:id/restore', checkPermission("product-edit"), productController.undoAttributePatch);

attributeApi.delete('/:id', checkPermission("product-delete"), productController.deleteAttributePatch);

api.patch('/:id/seo', upload.none(), checkPermission("product-edit"), productValidate.editSEOPatch, productController.editSEOPatch);

api.get('/csv', checkPermission("product-edit"), productController.exportCSV);

api.post('/csv', csvUpload.single("file"), checkPermission("product-create"), productValidate.importCSVPost, productController.importCSVPost);

export const recommendationApi = Router();

recommendationApi.post('/', checkPermission("product-edit"), productController.recomputeRecommendationsPost);

recommendationApi.get('/latest', checkPermission("product-edit"), productController.recomputeRecommendationsStatus);
