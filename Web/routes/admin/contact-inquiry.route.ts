import { Router } from "express";
import * as contactInquiryController from "../../controllers/admin/contact-inquiry.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

import { permanentOnly } from "../../helpers/rest.helper";
const router = Router();

router.get('/list', checkPermission("contact-inquiry-list"), contactInquiryController.list);

router.get('/trash', checkPermission("contact-inquiry-list"), contactInquiryController.trash);

export default router;

export const api = Router();

api.delete('/:id', permanentOnly, checkPermission("contact-inquiry-delete"), contactInquiryController.destroyDelete);

api.post('/trash', checkPermission("contact-inquiry-delete"), contactInquiryController.deleteManyPatch);

api.post('/:id/restore', checkPermission("contact-inquiry-edit"), contactInquiryController.undoPatch);

api.post('/restore', checkPermission("contact-inquiry-edit"), contactInquiryController.undoManyPatch);

api.delete('/', checkPermission("contact-inquiry-delete"), contactInquiryController.destroyManyDelete);

api.delete('/:id', checkPermission("contact-inquiry-delete"), contactInquiryController.deletePatch);

api.put('/:id/status/:status', checkPermission("contact-inquiry-edit"), contactInquiryController.changeStatusPatch);
