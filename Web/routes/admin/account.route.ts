import { Router } from "express";
import * as accountController from "../../controllers/admin/account.controller";
import { textForm } from "../../helpers/upload.helper";
import * as accountValidate from "../../validates/admin/account.validate";
import * as authMiddleware from "../../middlewares/admin/auth.middleware";
import { pageRateLimit, MINUTE } from "../../middlewares/rate-limit.middleware";
import { emailOf } from "../../helpers/rate-limit.helper";

const router = Router();

const upload = textForm;

router.get('/login', accountController.login);

export default router;

export const sessionApi = Router();

sessionApi.post('/', upload.none(), pageRateLimit({ windowMs: 15 * MINUTE, max: 30 }, { windowMs: 15 * MINUTE, max: 10, key: (req) => `${req.ip}|${emailOf(req)}` }), accountValidate.loginPost, accountController.loginPost);

sessionApi.delete('/current', authMiddleware.verifyToken, accountController.logout);
