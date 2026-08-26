import Block from "../models/block.model";
import Product from "../models/product.model";
import Blog from "../models/blog.model";
import CategoryProduct from "../models/category-product.model";
import CategoryBlog from "../models/category-blog.model";
import AccountAdmin from "../models/account-admin.model";
import AccountUser from "../models/account-user.model";
import Setting from "../models/setting.model";
import Review from "../models/review.model";
import ChatMessage from "../models/chat-message.model";

function deepReplace(obj: unknown, oldPath: string, newPath: string): unknown {
  if (typeof obj === "string") {
    return obj.split(oldPath).join(newPath);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepReplace(item, oldPath, newPath));
  }
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj as object)) {
      result[key] = deepReplace((obj as Record<string, unknown>)[key], oldPath, newPath);
    }
    return result;
  }
  return obj;
}

export async function propagateMediaRename(
  oldPath: string,
  newPath: string
): Promise<void> {
  const [blocks, settings] = await Promise.all([
    Block.find({}).select("_id data"),
    Setting.find({}).select("_id data"),
  ]);

  const updates: Promise<unknown>[] = [];

  for (const block of blocks) {
    if (!block.data || !JSON.stringify(block.data).includes(oldPath)) continue;
    updates.push(Block.updateOne({ _id: block._id }, { $set: { data: deepReplace(block.data, oldPath, newPath) } }));
  }

  for (const setting of settings) {
    if (!setting.data || !JSON.stringify(setting.data).includes(oldPath)) continue;
    updates.push(Setting.updateOne({ _id: setting._id }, { $set: { data: deepReplace(setting.data, oldPath, newPath) } }));
  }

  const rawOld = oldPath.replace(/^\/media\//, "");
  const rawNew = newPath.replace(/^\/media\//, "");

  updates.push(
    Product.updateMany({ images: oldPath }, { $set: { "images.$[elem]": newPath } }, { arrayFilters: [{ elem: oldPath }] }),
    Review.updateMany({ images: oldPath }, { $set: { "images.$[elem]": newPath } }, { arrayFilters: [{ elem: oldPath }] }),
    ChatMessage.updateMany({ files: oldPath }, { $set: { "files.$[elem]": newPath } }, { arrayFilters: [{ elem: oldPath }] }),
    Blog.updateMany({ avatar: oldPath }, { $set: { avatar: newPath } }),
    CategoryProduct.updateMany({ avatar: oldPath }, { $set: { avatar: newPath } }),
    CategoryBlog.updateMany({ avatar: oldPath }, { $set: { avatar: newPath } }),
    AccountAdmin.updateMany({ avatar: oldPath }, { $set: { avatar: newPath } }),
    AccountUser.updateMany({ avatar: oldPath }, { $set: { avatar: newPath } }),
    Product.updateMany({ images: rawOld }, { $set: { "images.$[elem]": rawNew } }, { arrayFilters: [{ elem: rawOld }] }),
    Review.updateMany({ images: rawOld }, { $set: { "images.$[elem]": rawNew } }, { arrayFilters: [{ elem: rawOld }] }),
    ChatMessage.updateMany({ files: rawOld }, { $set: { "files.$[elem]": rawNew } }, { arrayFilters: [{ elem: rawOld }] }),
    Blog.updateMany({ avatar: rawOld }, { $set: { avatar: rawNew } }),
    CategoryProduct.updateMany({ avatar: rawOld }, { $set: { avatar: rawNew } }),
    CategoryBlog.updateMany({ avatar: rawOld }, { $set: { avatar: rawNew } }),
    AccountAdmin.updateMany({ avatar: rawOld }, { $set: { avatar: rawNew } }),
    AccountUser.updateMany({ avatar: rawOld }, { $set: { avatar: rawNew } })
  );

  await Promise.all(updates);
}

export async function propagateMediaDelete(filePath: string): Promise<void> {
  const [blocks, settings] = await Promise.all([
    Block.find({}).select("_id data"),
    Setting.find({}).select("_id data"),
  ]);

  const updates: Promise<unknown>[] = [];

  function deepRemove(obj: unknown, target: string): unknown {
    if (typeof obj === "string") return obj === target ? null : obj;
    if (Array.isArray(obj)) return obj.filter((item) => item !== target).map((item) => deepRemove(item, target));
    if (obj && typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(obj as object)) result[key] = deepRemove((obj as Record<string, unknown>)[key], target);
      return result;
    }
    return obj;
  }

  for (const block of blocks) {
    if (!block.data || !JSON.stringify(block.data).includes(filePath)) continue;
    updates.push(Block.updateOne({ _id: block._id }, { $set: { data: deepRemove(block.data, filePath) } }));
  }

  for (const setting of settings) {
    if (!setting.data || !JSON.stringify(setting.data).includes(filePath)) continue;
    updates.push(Setting.updateOne({ _id: setting._id }, { $set: { data: deepRemove(setting.data, filePath) } }));
  }

  updates.push(
    Product.updateMany({ images: filePath }, { $pull: { images: filePath } }),
    Review.updateMany({ images: filePath }, { $pull: { images: filePath } }),
    ChatMessage.updateMany({ files: filePath }, { $pull: { files: filePath } }),
    Blog.updateMany({ avatar: filePath }, { $set: { avatar: null } }),
    CategoryProduct.updateMany({ avatar: filePath }, { $set: { avatar: null } }),
    CategoryBlog.updateMany({ avatar: filePath }, { $set: { avatar: null } }),
    AccountAdmin.updateMany({ avatar: filePath }, { $set: { avatar: null } }),
    AccountUser.updateMany({ avatar: filePath }, { $set: { avatar: null } })
  );

  await Promise.all(updates);
}
