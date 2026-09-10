import { Router } from "express";
import * as reviewController from "../../controllers/admin/review.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get('/list', reviewController.list);

router.patch('/change-status/:id/:status', checkPermission("review-edit"), reviewController.changeStatusPatch);

router.patch('/clear-reports/:id', checkPermission("review-edit"), reviewController.clearReportsPatch);

router.delete('/delete/:id', checkPermission("review-delete"), reviewController.deletePatch);

router.delete('/destroy-many', checkPermission("review-delete"), reviewController.destroyManyDelete);

export default router;
