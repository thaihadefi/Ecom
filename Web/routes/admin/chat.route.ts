import { Router } from "express";
import * as chatController from "../../controllers/admin/chat.controller";
import { chatUpload } from "../../helpers/upload.helper";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

const upload = chatUpload;

router.get('/list/my-chat', checkPermission("chat-list"), chatController.myChatList);

router.get('/detail/:id', checkPermission("chat-list"), chatController.detail);

router.get('/rate/:id', checkPermission("chat-list"), chatController.rate);

export default router;

export const chatApi = Router();

chatApi.get('/:roomId/messages', checkPermission("chat-list"), chatController.messages);

chatApi.post('/:roomId/attachments', checkPermission("chat-reply"), upload.array("files"), chatController.uploadPost);

chatApi.patch('/:roomId', checkPermission("chat-reply"), chatController.changeStatusPatch);

chatApi.get('/:id/reply-suggestion', checkPermission("chat-reply"), chatController.suggestReply);

chatApi.post('/:id/reply-refinements', checkPermission("chat-reply"), chatController.editReplyPost);

chatApi.get('/:id/summary', checkPermission("chat-list"), chatController.summary);

chatApi.get('/:id/customer-emotion', checkPermission("chat-list"), chatController.customerEmotions);
