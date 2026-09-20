import { Router } from "express";
import * as reviewController from "../../controllers/admin/review.controller";
import { checkAnyPermission, checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get('/list', checkAnyPermission("review-edit", "review-delete"), reviewController.list);

export default router;

export const api = Router();

api.delete('/:id', checkPermission("review-delete"), reviewController.deletePatch);

api.delete('/', checkPermission("review-delete"), reviewController.destroyManyDelete);

api.put('/:id/status/:status', checkPermission("review-edit"), reviewController.changeStatusPatch);

api.delete('/:id/reports', checkPermission("review-edit"), reviewController.clearReportsPatch);
