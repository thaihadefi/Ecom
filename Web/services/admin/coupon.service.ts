import { toMoney } from '../../configs/storefront.config';
import { toSearchText } from '../../helpers/slugify.helper';
import Coupon from '../../models/coupon.model';
import { ICoupon, ICouponInput } from '../../interfaces/models/coupon.interface';
import { getStorefront } from '../../configs/storefront.config';
import { formatInZone, zonedTimeToUtc } from '../../helpers/timezone.helper';
import { softDeleteMany, restoreMany, permanentlyDeleteMany, getTrash } from "../../helpers/admin-crud.helper";
import { paginatedSearch } from "../../helpers/list-query.helper";

// A coupon date typed as YYYY-MM-DD or DD/MM/YYYY is a calendar day in the store time zone.
const parseCouponDay = (raw: unknown, endOfDay = false): Date | undefined => {
  const s = String(raw ?? "").trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : [];
  if (!y) return undefined;
  const time = endOfDay ? [23, 59, 59, 999] : [0, 0, 0, 0];
  const date = zonedTimeToUtc(getStorefront().timezone, Number(y), Number(m) - 1, Number(d), ...time);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

// Value for the coupon form's date pickers.
const couponDayText = (date: Date) => formatInZone(date, getStorefront().timezone, "DD/MM/YYYY");

export const createCoupon = async (couponData: ICouponInput): Promise<{ success: boolean; status?: number; message: string; coupon?: ICoupon }> => {
  const existCoupon = await Coupon.findOne({
    code: String(couponData.code || "").trim(),
    deleted: false
  }).select("_id");

  if (existCoupon) {
    return { success: false, status: 409, message: "Coupon already exists!" };
  }

  couponData.code = String(couponData.code || "").trim();
  couponData.value = couponData.typeDiscount === "percentage" ? Math.round(parseFloat(String(couponData.value || 0)) * 100) / 100 || 0 : toMoney(couponData.value);
  couponData.minOrderValue = toMoney(couponData.minOrderValue);
  couponData.maxDiscountValue = toMoney(couponData.maxDiscountValue);
  couponData.usageLimit = couponData.usageLimit ? parseInt(couponData.usageLimit as string) : 0;
  couponData.startDate = parseCouponDay(couponData.startDate);
  couponData.endDate = parseCouponDay(couponData.endDate, true);
  couponData.search = toSearchText(`${couponData.code} ${couponData.name}`);

  const newRecord = new Coupon(couponData);
  await newRecord.save();

  return { success: true, message: "Coupon created successfully!", coupon: newRecord };
};

export const getCouponList = async (keyword?: unknown, rawPage?: unknown) => {
  const { recordList, pagination } = await paginatedSearch(Coupon, keyword, rawPage);

  for (const item of recordList) {
    if (item.startDate) {
      item.startDateFormat = couponDayText(item.startDate);
    }
    if (item.endDate) {
      item.endDateFormat = couponDayText(item.endDate);
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
    couponDetail.startDateFormat = couponDayText(couponDetail.startDate);
  }
  if (couponDetail.endDate) {
    couponDetail.endDateFormat = couponDayText(couponDetail.endDate);
  }

  return couponDetail;
};

export const updateCoupon = async (id: string, updateData: ICouponInput): Promise<{ success: boolean; status?: number; message: string }> => {
  const couponDetail = await Coupon.findOne({
    _id: id,
    deleted: false
  });

  if (!couponDetail) {
    return { success: false, status: 404, message: "ID does not exist!" };
  }

  const existCoupon = await Coupon.findOne({
    _id: { $ne: id },
    code: String(updateData.code || "").trim(),
    deleted: false
  }).select("_id");

  if (existCoupon) {
    return { success: false, status: 409, message: "Coupon already exists!" };
  }

  updateData.code = String(updateData.code || "").trim();
  updateData.value = updateData.typeDiscount === "percentage" ? Math.round(parseFloat(String(updateData.value || 0)) * 100) / 100 || 0 : toMoney(updateData.value);
  updateData.minOrderValue = toMoney(updateData.minOrderValue);
  updateData.maxDiscountValue = toMoney(updateData.maxDiscountValue);
  updateData.usageLimit = updateData.usageLimit ? parseInt(String(updateData.usageLimit)) : 0;
  updateData.startDate = parseCouponDay(updateData.startDate);
  updateData.endDate = parseCouponDay(updateData.endDate, true);
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
