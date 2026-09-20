import { Router } from "express";
import * as fileManagerController from "../../controllers/admin/file-manager.controller";
import * as fileManagerValidate from "../../validates/admin/file-manager.validate";
import { adminFileUpload } from "../../helpers/upload.helper";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

const upload = adminFileUpload;

const fm = checkPermission("file-manager");

router.get('/', fm, fileManagerController.fileManager);

router.get('/iframe', fm, fileManagerController.iframe);

export default router;

export const fileApi = Router();

fileApi.post('/', fm, upload.array('files'), fileManagerController.uploadPost);

fileApi.patch('/name', fm, upload.none(), fileManagerValidate.changeFileNamePatch, fileManagerController.changeFileNamePatch);

fileApi.delete('/', fm, fileManagerController.deleteFileDel);

fileApi.patch('/location', fm, upload.none(), fileManagerController.moveFilePatch);

export const folderApi = Router();

folderApi.post('/', fm, upload.none(), fileManagerController.createFolderPost);

folderApi.patch('/name', fm, upload.none(), fileManagerController.renameFolderPatch);

folderApi.patch('/location', fm, upload.none(), fileManagerController.moveFolderPatch);

folderApi.delete('/', fm, fileManagerController.deleteFolderDel);
