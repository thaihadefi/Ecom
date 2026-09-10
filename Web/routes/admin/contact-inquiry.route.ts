import { Router } from "express";
import * as contactInquiryController from "../../controllers/admin/contact-inquiry.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get('/list', checkPermission("contact-inquiry-list"), contactInquiryController.list);

router.get('/trash', checkPermission("contact-inquiry-list"), contactInquiryController.trash);

router.patch('/change-status/:id/:status', checkPermission("contact-inquiry-edit"), contactInquiryController.changeStatusPatch);

router.patch('/delete/:id', checkPermission("contact-inquiry-delete"), contactInquiryController.deletePatch);

router.patch('/delete-many', checkPermission("contact-inquiry-delete"), contactInquiryController.deleteManyPatch);

router.patch('/change-multi', checkPermission("contact-inquiry-edit"), contactInquiryController.changeMultiPatch);

router.patch('/undo/:id', checkPermission("contact-inquiry-edit"), contactInquiryController.undoPatch);

router.patch('/undo-many', checkPermission("contact-inquiry-edit"), contactInquiryController.undoManyPatch);

router.delete('/destroy/:id', checkPermission("contact-inquiry-delete"), contactInquiryController.destroyDelete);

router.delete('/destroy-many', checkPermission("contact-inquiry-delete"), contactInquiryController.destroyManyDelete);

export default router;
