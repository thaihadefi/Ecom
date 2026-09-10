import { Router } from "express";
import * as orderController from "../../controllers/admin/order.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get('/list', orderController.list);
router.get('/trash', orderController.trash);
router.get('/edit/:id', orderController.edit);
router.get('/export/csv', orderController.exportCSV);

router.patch('/edit/:id', checkPermission("order-edit"), orderController.editPatch);
router.patch('/change-multi', checkPermission("order-edit"), orderController.changeMultiPatch);
router.patch('/undo/:id', checkPermission("order-edit"), orderController.undoPatch);
router.patch('/undo-many', checkPermission("order-edit"), orderController.undoManyPatch);
router.patch('/delete/:id', checkPermission("order-delete"), orderController.deletePatch);
router.patch('/delete-many', checkPermission("order-delete"), orderController.deleteManyPatch);
router.delete('/destroy/:id', checkPermission("order-delete"), orderController.destroyDelete);
router.delete('/destroy-many', checkPermission("order-delete"), orderController.destroyManyDelete);

export default router;
