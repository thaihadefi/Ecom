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

/**
 * Deep replace all occurrences of `oldPath` with `newPath` inside any JS value.
 * Works on strings, arrays, and plain objects (recursive).
 */
function deepReplace(obj: any, oldPath: string, newPath: string): any {
  if (typeof obj === "string") {
    // Global replace within any string value
    return obj.split(oldPath).join(newPath);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepReplace(item, oldPath, newPath));
  }
  if (obj && typeof obj === "object") {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = deepReplace(obj[key], oldPath, newPath);
    }
    return result;
  }
  return obj; // numbers, booleans, null, etc.
}

/**
 * After a file is renamed or moved, propagate the path change
 * across all collections that may store media references.
 *
 * @param oldPath  e.g. "/media/old-name.jpg"
 * @param newPath  e.g. "/media/new-name.jpg"
 */
export async function propagateMediaRename(
  oldPath: string,
  newPath: string
): Promise<void> {
  // Fetch JSON-blob collections and simple collections in parallel
  const [blocks, settings] = await Promise.all([
    Block.find({}).select("_id data"),
    Setting.find({}).select("_id data"),
  ]);

  // Build all update promises
  const updates: Promise<any>[] = [];

  // Blocks – deeply nested JSON
  for (const block of blocks) {
    if (!block.data) continue;
    if (!JSON.stringify(block.data).includes(oldPath)) continue;
    const updated = deepReplace(block.data, oldPath, newPath);
    updates.push(Block.updateOne({ _id: block._id }, { $set: { data: updated } }));
  }

  // Settings – deeply nested JSON
  for (const setting of settings) {
    if (!setting.data) continue;
    if (!JSON.stringify(setting.data).includes(oldPath)) continue;
    const updated = deepReplace(setting.data, oldPath, newPath);
    updates.push(Setting.updateOne({ _id: setting._id }, { $set: { data: updated } }));
  }

  // Simple updateMany — all independent
  updates.push(
    Product.updateMany(
      { images: oldPath },
      { $set: { "images.$[elem]": newPath } },
      { arrayFilters: [{ elem: oldPath }] }
    ),
    Blog.updateMany({ avatar: oldPath }, { $set: { avatar: newPath } }),
    CategoryProduct.updateMany({ avatar: oldPath }, { $set: { avatar: newPath } }),
    CategoryBlog.updateMany({ avatar: oldPath }, { $set: { avatar: newPath } }),
    AccountAdmin.updateMany({ avatar: oldPath }, { $set: { avatar: newPath } }),
    AccountUser.updateMany({ avatar: oldPath }, { $set: { avatar: newPath } }),
    Review.updateMany(
      { images: oldPath },
      { $set: { "images.$[elem]": newPath } },
      { arrayFilters: [{ elem: oldPath }] }
    ),
    ChatMessage.updateMany(
      { files: oldPath },
      { $set: { "files.$[elem]": newPath } },
      { arrayFilters: [{ elem: oldPath }] }
    )
  );

  await Promise.all(updates);
}

/**
 * After a file is deleted, remove all references to it across collections.
 * Strings are nulled; array entries are pulled out.
 *
 * @param filePath  e.g. "/media/subfolder/image.jpg"
 */
export async function propagateMediaDelete(filePath: string): Promise<void> {
  const [blocks, settings] = await Promise.all([
    Block.find({}).select("_id data"),
    Setting.find({}).select("_id data"),
  ]);

  const updates: Promise<any>[] = [];

  function deepRemove(obj: any, target: string): any {
    if (typeof obj === "string") return obj === target ? null : obj;
    if (Array.isArray(obj)) return obj.filter((item) => item !== target).map((item) => deepRemove(item, target));
    if (obj && typeof obj === "object") {
      const result: any = {};
      for (const key of Object.keys(obj)) result[key] = deepRemove(obj[key], target);
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
