import { Router } from "express";
import fileManagerRoutes from "./file-manager.route";
import mediaRoutes from "./media.route";
import * as authMiddleware from "../middlewares/auth.middleware";

const router = Router();

router.use('/file-manager', authMiddleware.verifySecret, fileManagerRoutes);
router.use('/media', mediaRoutes);

export default router;