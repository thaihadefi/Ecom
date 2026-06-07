import { Router } from "express";
import * as fileManagerController from "../../controllers/admin/file-manager.controller";
import * as fileManagerValidate from "../../validates/admin/file-manager.validate";
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

const fm = checkPermission("file-manager");

router.get('/', fm, fileManagerController.fileManager);

router.post('/upload', fm, upload.array('files'), fileManagerController.uploadPost);

router.patch('/change-file-name', fm, upload.none(), fileManagerValidate.changeFileNamePatch, fileManagerController.changeFileNamePatch);

router.delete('/delete-file', fm, fileManagerController.deleteFileDel);

router.patch('/move-file', fm, upload.none(), fileManagerController.moveFilePatch);

router.post('/folder/create', fm, upload.none(), fileManagerController.createFolderPost);

router.patch('/folder/rename', fm, upload.none(), fileManagerController.renameFolderPatch);
router.patch('/folder/move', fm, upload.none(), fileManagerController.moveFolderPatch);

router.delete('/folder/delete', fm, fileManagerController.deleteFolderDel);

router.get('/iframe', fm, fileManagerController.iframe);

export default router;
