import { Router } from "express";
import * as logController from "../../controllers/admin/log.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get('/list', checkPermission("log-view"), logController.list);

export default router;
