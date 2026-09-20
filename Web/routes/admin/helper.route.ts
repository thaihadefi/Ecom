import { Router } from "express";
import * as helperController from "../../controllers/admin/helper.controller";

const router = Router();

export default router;

export const slugApi = Router();

slugApi.post('/', helperController.generateSlugPost);
