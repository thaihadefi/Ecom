import { toSearchText } from '../../helpers/slugify.helper';
import Coupon from '../../models/coupon.model';
import { ICoupon, ICouponInput } from '../../interfaces/models/coupon.interface';
import moment from 'moment';
import { softDeleteMany, restoreMany, permanentlyDeleteMany, getTrash } from "../../helpers/admin-crud.helper";
import { paginatedSearch } from "../../helpers/list-query.helper";

export const createCoupon = async (couponData: ICouponInput): Promise<{ success: boolean; message: string; coupon?: ICoupon }> => {
  const existCoupon = await Coupon.findOne({
    code: String(couponData.code || ""),
    deleted: false
  }).select("_id");

  if (existCoupon) {
    return { success: false, message: "Coupon already exists!" };
  }

  couponData.value = couponData.value ? parseInt(couponData.value as string) : 0;
  couponData.minOrderValue = couponData.minOrderValue ? parseInt(couponData.minOrderValue as string) : 0;
  couponData.maxDiscountValue = couponData.maxDiscountValue ? parseInt(couponData.maxDiscountValue as string) : 0;
  couponData.usageLimit = couponData.usageLimit ? parseInt(couponData.usageLimit as string) : 0;
  couponData.startDate = couponData.startDate ? moment(couponData.startDate as string, "DD/MM/YYYY").toDate() : undefined;
  couponData.endDate = couponData.endDate ? moment(couponData.endDate as string, "DD/MM/YYYY").toDate() : undefined;
  couponData.search = toSearchText(`${couponData.code} ${couponData.name}`);

  const newRecord = new Coupon(couponData);
  await newRecord.save();

  return { success: true, message: "Coupon created successfully!", coupon: newRecord };
};

export const getCouponList = async (keyword?: unknown, rawPage?: unknown) => {
  const { recordList, pagination } = await paginatedSearch(Coupon, keyword, rawPage);

  for (const item of recordList) {
    if (item.startDate) {
      item.startDateFormat = moment(item.startDate).format("DD/MM/YYYY");
    }
    if (item.endDate) {
      item.endDateFormat = moment(item.endDate).format("DD/MM/YYYY");
    }
  }

  return {
    recordList,
    pagination
  };
};

export const getCouponDetailById = async (id: string) => {
  const couponDetail = await Coupon.findOne({
    _id: id,
    deleted: false
  });

  if (!couponDetail) return null;

  if (couponDetail.startDate) {
    couponDetail.startDateFormat = moment(couponDetail.startDate).format("DD/MM/YYYY");
  }
  if (couponDetail.endDate) {
    couponDetail.endDateFormat = moment(couponDetail.endDate).format("DD/MM/YYYY");
  }

  return couponDetail;
};

export const updateCoupon = async (id: string, updateData: ICouponInput): Promise<{ success: boolean; message: string }> => {
  const couponDetail = await Coupon.findOne({
    _id: id,
    deleted: false
  });

  if (!couponDetail) {
    return { success: false, message: "ID does not exist!" };
  }

  const existCoupon = await Coupon.findOne({
    _id: { $ne: id },
    code: String(updateData.code || ""),
    deleted: false
  }).select("_id");

  if (existCoupon) {
    return { success: false, message: "Coupon already exists!" };
  }

  updateData.value = updateData.value ? parseInt(String(updateData.value)) : 0;
  updateData.minOrderValue = updateData.minOrderValue ? parseInt(String(updateData.minOrderValue)) : 0;
  updateData.maxDiscountValue = updateData.maxDiscountValue ? parseInt(String(updateData.maxDiscountValue)) : 0;
  updateData.usageLimit = updateData.usageLimit ? parseInt(String(updateData.usageLimit)) : 0;
  updateData.startDate = updateData.startDate ? moment(String(updateData.startDate), "DD/MM/YYYY").toDate() : undefined;
  updateData.endDate = updateData.endDate ? moment(String(updateData.endDate), "DD/MM/YYYY").toDate() : undefined;
  updateData.search = toSearchText(`${updateData.code} ${updateData.name}`);

  await Coupon.updateOne({ _id: id, deleted: false }, updateData);

  return { success: true, message: "Updated successfully!" };
};

export const softDeleteCoupon = async (id: string) => {
  await Coupon.updateOne({ _id: id }, { deleted: true, deletedAt: Date.now() });
  return { success: true, message: "Coupon deleted successfully!" };
};

export const softDeleteManyCoupons = (ids: string[]) => softDeleteMany(Coupon, ids, "coupon");

export const restoreCoupon = async (id: string) => {
  await Coupon.updateOne({ _id: id }, { deleted: false });
  return { success: true, message: "Restored successfully!" };
};

export const restoreManyCoupons = (ids: string[]) => restoreMany(Coupon, ids, "coupon");

export const permanentlyDeleteCoupon = async (id: string) => {
  await Coupon.deleteOne({ _id: id });
  return { success: true, message: "Deleted permanently!" };
};

export const permanentlyDeleteManyCoupons = (ids: string[]) => permanentlyDeleteMany(Coupon, ids, "coupon");

export const getCouponTrash = () => getTrash(Coupon, "_id name code status deletedAt");
