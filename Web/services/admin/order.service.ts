import mongoose from 'mongoose';
import { OrderStatus, OrderPaymentStatus } from '../../interfaces/models/order.interface';
import Order from '../../models/order.model';
import Product from '../../models/product.model';
import Coupon from '../../models/coupon.model';
import AccountUser from '../../models/account-user.model';
import { pointConfig } from '../../configs/variable.config';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { sendMail, emailTemplates } from '../../helpers/mail.helper';
import { escapeRegex } from '../../helpers/generate.helper';

export const getOrderList = async (rawKeyword?: unknown, rawPage?: unknown) => {
  const find: Record<string, unknown> = {
    deleted: false
  };

  if (rawKeyword) {
    const keyword = `${rawKeyword}`.trim();
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.$or = [
      { code: keywordRegex },
      { fullName: keywordRegex },
      { phone: keywordRegex }
    ];
  }

  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await Order.countDocuments(find);
  const pagination = getPagination(rawPage, limitItems, totalRecord);

  const recordList = await Order
    .find(find)
    .select("_id code fullName phone total orderStatus paymentStatus paymentMethod createdAt")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({ createdAt: "desc" });

  return {
    recordList,
    pagination
  };
};

export const getOrderDetailById = async (id: string) => {
  return Order.findOne({ _id: id, deleted: false });
};

export const updateOrderAdmin = async (
  id: string,
  orderStatus: string,
  paymentStatus: string,
  note?: string
) => {
  const order = await Order.findOne({ _id: id, deleted: false });

  if (!order) {
    return { success: false, message: "Order does not exist!" };
  }

  const FINALIZED = ["completed", "cancelled", "returned"];
  if (FINALIZED.includes(order.orderStatus) && orderStatus !== order.orderStatus) {
    return { success: false, message: "Cannot change the status of a finalized order!" };
  }

  if (order.paymentStatus === "paid" && paymentStatus === "unpaid") {
    return { success: false, message: "Cannot change paid order status back to unpaid!" };
  }

  const TERMINAL = ["cancelled", "returned"];
  const goingTerminal = TERMINAL.includes(orderStatus) && !TERMINAL.includes(order.orderStatus);
  const wasUnpaid = order.paymentStatus !== "paid";
  const statusChanged = order.orderStatus !== orderStatus;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      order.orderStatus = orderStatus as OrderStatus;
      order.paymentStatus = paymentStatus as OrderPaymentStatus;
      order.note = note;
      await order.save({ session });

      if (goingTerminal && order.items && order.items.length > 0) {
        await Product.bulkWrite(
          order.items.map((item) => ({
            updateOne: {
              filter: { _id: item.productId },
              update: { $inc: { stock: item.quantity || 0 } }
            }
          })),
          { session }
        );
      }

      if (goingTerminal) {
        if (order.usedPoint && order.usedPoint > 0) {
          await AccountUser.updateOne(
            { _id: order.userId },
            { $inc: { usedPoint: -order.usedPoint } },
            { session }
          );
        }
        if (order.coupon) {
          await Coupon.updateOne(
            { code: order.coupon, usedCount: { $gt: 0 } },
            { $inc: { usedCount: -1 } },
            { session }
          );
        }
      }

      if (wasUnpaid && paymentStatus === "paid" && order.userId) {
        const productValue = (order.subTotal || 0) - (order.discount || 0);
        const pointEarned = Math.floor(Math.max(0, productValue) / pointConfig.MONEY_PER_POINT);
        if (pointEarned > 0) {
          await AccountUser.updateOne(
            { _id: order.userId, deleted: false, status: "active" },
            { $inc: { totalPoint: pointEarned } },
            { session }
          );
        }
      }
    });
  } finally {
    session.endSession();
  }

  if (statusChanged && order.userId) {
    AccountUser.findOne({ _id: order.userId }).select("email fullName").then(user => {
      if (!user?.email) return;
      return emailTemplates.orderStatusUpdate(
        { code: order.code || "", fullName: user.fullName || "" },
        orderStatus
      ).then(tpl => sendMail(user.email!, tpl.subject, tpl.html));
    }).catch(console.error);
  }

  return { success: true, message: "Order updated successfully!", order };
};

export const softDeleteOrder = async (id: string) => {
  const activeOrder = await Order.findOne({
    _id: id,
    orderStatus: { $nin: ["cancelled", "returned"] },
    deleted: false
  });
  if (activeOrder) {
    return {
      success: false,
      message: "Cannot delete an active order! Please change its status to Cancelled or Returned first."
    };
  }

  await Order.updateOne({ _id: id }, { deleted: true, deletedAt: new Date() });
  return { success: true, message: "Order deleted successfully!" };
};

export const softDeleteManyOrders = async (ids: string[]) => {
  const activeOrdersCount = await Order.countDocuments({
    _id: { $in: ids },
    orderStatus: { $nin: ["cancelled", "returned"] },
    deleted: false
  });
  if (activeOrdersCount > 0) {
    return {
      success: false,
      message: "Cannot delete active orders! Please change their status to Cancelled or Returned first."
    };
  }

  await Order.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
  return { success: true, message: `Moved ${ids.length} order(s) to trash!` };
};

export const restoreOrder = async (id: string) => {
  await Order.updateOne({ _id: id }, { deleted: false });
  return { success: true, message: "Restored successfully!" };
};

export const restoreManyOrders = async (ids: string[]) => {
  await Order.updateMany({ _id: { $in: ids } }, { deleted: false });
  return { success: true, message: `Restored ${ids.length} order(s)!` };
};

export const permanentlyDeleteOrder = async (id: string) => {
  const activeOrder = await Order.findOne({
    _id: id,
    orderStatus: { $nin: ["cancelled", "returned"] }
  });
  if (activeOrder) {
    return {
      success: false,
      message: "Cannot delete an active order! Please change its status to Cancelled or Returned first."
    };
  }

  await Order.deleteOne({ _id: id });
  return { success: true, message: "Deleted permanently!" };
};

export const permanentlyDeleteManyOrders = async (ids: string[]) => {
  const activeOrdersCount = await Order.countDocuments({
    _id: { $in: ids },
    orderStatus: { $nin: ["cancelled", "returned"] }
  });
  if (activeOrdersCount > 0) {
    return {
      success: false,
      message: "Cannot delete active orders! Please change their status to Cancelled or Returned first."
    };
  }

  await Order.deleteMany({ _id: { $in: ids } });
  return { success: true, message: `Permanently deleted ${ids.length} order(s)!` };
};

export const getOrderTrash = async () => {
  return Order.find({ deleted: true })
    .select("_id code fullName phone total orderStatus paymentStatus deletedAt")
    .sort({ deletedAt: "desc" });
};

export const getOrdersBatchForExport = async (skip: number, limit: number) => {
  return Order.find({ deleted: false }).skip(skip).limit(limit);
};
