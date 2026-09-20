import { Router } from "express";
import { fileApi, folderApi } from "./file-manager.route";
import mediaRoutes from "./media.route";
import * as authMiddleware from "../middlewares/auth.middleware";

const router = Router();

router.use('/files', authMiddleware.verifySecret, fileApi);
router.use('/folders', authMiddleware.verifySecret, folderApi);
router.use('/media', mediaRoutes);

export default router;
