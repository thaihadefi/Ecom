import { Model, UpdateQuery } from "mongoose";

type SoftDeletable = { deleted: boolean; deletedAt?: Date | null };

export const softDeleteMany = async <T extends SoftDeletable>(model: Model<T>, ids: string[], label: string) => {
  await model.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() } as UpdateQuery<T>);
  return { success: true, message: `Moved ${ids.length} ${label}(s) to trash!` };
};

export const restoreMany = async <T extends SoftDeletable>(model: Model<T>, ids: string[], label: string) => {
  await model.updateMany({ _id: { $in: ids } }, { deleted: false } as UpdateQuery<T>);
  return { success: true, message: `Restored ${ids.length} ${label}(s)!` };
};

export const permanentlyDeleteMany = async <T>(model: Model<T>, ids: string[], label: string) => {
  await model.deleteMany({ _id: { $in: ids } });
  return { success: true, message: `Permanently deleted ${ids.length} ${label}(s)!` };
};

export const getTrash = <T extends SoftDeletable>(model: Model<T>, select: string) => {
  return model.find({ deleted: true }).select(select).sort({ deletedAt: "desc" });
};
