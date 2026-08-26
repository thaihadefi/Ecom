import { Router } from "express";
import * as chatController from "../../controllers/admin/chat.controller";
import multer from "multer";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, true);
  }
});

router.get('/list/my-chat', checkPermission("chat-list"), chatController.myChatList);

router.get('/detail/:id', checkPermission("chat-list"), chatController.detail);

router.get('/messages', checkPermission("chat-list"), chatController.messages);

router.post(
  '/upload',
  checkPermission("chat-reply"),
  upload.array("files"),
  chatController.uploadPost
);

router.patch('/change-status', checkPermission("chat-reply"), chatController.changeStatusPatch);

router.get('/rate/:id', checkPermission("chat-list"), chatController.rate);

router.get('/suggest-reply/:id', checkPermission("chat-reply"), chatController.suggestReply);

router.post('/edit-reply/:id', checkPermission("chat-reply"), chatController.editReplyPost);

router.get('/summary/:id', checkPermission("chat-list"), chatController.summary);

router.get('/customer-emotions/:id', checkPermission("chat-list"), chatController.customerEmotions);

export default router;
