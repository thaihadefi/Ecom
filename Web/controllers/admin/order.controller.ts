import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order from '../../models/order.model';
import Product from '../../models/product.model';
import Coupon from '../../models/coupon.model';
import AccountUser from '../../models/account-user.model';
import { pathAdmin, pointConfig } from '../../configs/variable.config';
import { Parser } from 'json2csv';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { sendMail, emailTemplates } from '../../helpers/mail.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import { logAdminAction } from '../../helpers/log.helper';

export const list = async (req: Request, res: Response) => {
  const find: any = {
    deleted: false
  };

  if(req.query.keyword) {
    const keyword = `${req.query.keyword}`.trim();
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.$or = [
      { code: keywordRegex },
      { fullName: keywordRegex },
      { phone: keywordRegex }
    ];
  }

  // Pagination
  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await Order.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination
  
  const recordList = await Order
    .find(find)
    .select("_id code fullName phone total orderStatus paymentStatus paymentMethod createdAt")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({
      createdAt: "desc"
    });
  
  res.render("admin/pages/order-list", {
    pageTitle: "Order Management",
    recordList: recordList,
    pagination: pagination
  });
}

export const edit = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const orderDetail = await Order.findOne({
      _id: id,
      deleted: false
    })

    if(!orderDetail) {
      res.redirect(`/${pathAdmin}/order/list`);
      return;
    }

    res.render("admin/pages/order-edit", {
      pageTitle: "Edit Order",
      orderDetail: orderDetail
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/order/list`);
  }
}

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { orderStatus, paymentStatus, note } = req.body;

    // Check if order exists
    const order = await Order.findOne({
      _id: id,
      deleted: false
    });

    if (!order) {
      res.json({
        code: "error",
        message: "Order does not exist!"
      });
      return;
    }

    // Do not allow reverting finalized orders
    const FINALIZED = ["completed", "cancelled", "returned"];
    if (FINALIZED.includes(order.orderStatus) && orderStatus !== order.orderStatus) {
      res.json({
        code: "error",
        message: "Cannot change the status of a finalized order!"
      });
      return;
    }

    // Do not allow changing paid to unpaid
    if (order.paymentStatus === "paid" && paymentStatus === "unpaid") {
      res.json({
        code: "error",
        message: "Cannot change paid order status back to unpaid!"
      });
      return;
    }

    const TERMINAL = ["cancelled", "returned"];
    const goingTerminal = TERMINAL.includes(orderStatus) && !TERMINAL.includes(order.orderStatus);
    const wasUnpaid = order.paymentStatus !== "paid";
    const statusChanged = order.orderStatus !== orderStatus;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        order.orderStatus = orderStatus;
        order.paymentStatus = paymentStatus;
        order.note = note;
        await order.save({ session });

        // Restore stock when order is cancelled/returned
        if (goingTerminal && order.items?.length > 0) {
          await Product.bulkWrite(
            order.items.map((item: any) => ({
              updateOne: {
                filter: { _id: item.productId },
                update: { $inc: { stock: item.quantity } }
              }
            })),
            { session }
          );
        }

        // Refund points and coupon usage when order is cancelled/returned
        if (goingTerminal) {
          if ((order as any).usedPoint > 0) {
            await AccountUser.updateOne(
              { _id: order.userId },
              { $inc: { usedPoint: -(order as any).usedPoint } },
              { session }
            );
          }
          if ((order as any).coupon) {
            await Coupon.updateOne(
              { code: (order as any).coupon, usedCount: { $gt: 0 } },
              { $inc: { usedCount: -1 } },
              { session }
            );
          }
        }

        // Reward points when payment is marked as paid
        if (wasUnpaid && paymentStatus === "paid" && order.userId) {
          const productValue = ((order as any).subTotal || 0) - ((order as any).discount || 0);
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

    // Send status update email (non-blocking)
    if (statusChanged && order.userId) {
      AccountUser.findOne({ _id: order.userId }).select("email fullName").then(user => {
        if (!user?.email) return;
        return emailTemplates.orderStatusUpdate(
          { code: (order as any).code, fullName: (user as any).fullName || "" },
          orderStatus
        ).then(tpl => sendMail((user as any).email, tpl.subject, tpl.html));
      }).catch(console.error);
    }

    logAdminAction(req, `Updated order #${(order as any).code || id} (Status: ${orderStatus}, Payment: ${paymentStatus})`);

    res.json({
      code: "success",
      message: "Order updated successfully!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "An error occurred, please try again!"
    });
  }
};

export const exportCSV = async (req: Request, res: Response) => {
  try {
    res.header("Content-Type", "text/csv");
    res.attachment("orders.csv");
    res.write("\uFEFF"); // BOM

    const BATCH = 500;
    let skip = 0;
    let headerWritten = false;
    const parser = new Parser({ header: true });

    while (true) {
      const batch = await Order.find({ deleted: false }).skip(skip).limit(BATCH);
      if (!batch.length) break;

      let csv = parser.parse(batch);
      if (headerWritten) {
        // Strip header row from subsequent batches
        csv = csv.substring(csv.indexOf("\n") + 1);
      }
      res.write(csv + "\n");
      headerWritten = true;
      skip += BATCH;
      if (batch.length < BATCH) break;
    }

    res.end();
  } catch (err) {
    console.error("Export CSV error:", err);
  }
}
export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }

    const activeOrdersCount = await Order.countDocuments({
      _id: { $in: ids },
      orderStatus: { $nin: ["cancelled", "returned"] }
    });
    if (activeOrdersCount > 0) {
      res.json({
        code: "error",
        message: "Cannot delete active orders! Please change their status to Cancelled or Returned first."
      });
      return;
    }

    await Order.deleteMany({ _id: { $in: ids } });
    res.json({ code: "success", message: `Deleted ${ids.length} order(s) permanently!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const activeOrder = await Order.findOne({
      _id: req.params.id,
      orderStatus: { $nin: ["cancelled", "returned"] },
      deleted: false
    });
    if (activeOrder) {
      res.json({
        code: "error",
        message: "Cannot delete an active order! Please change its status to Cancelled or Returned first."
      });
      return;
    }

    await Order.updateOne({ _id: req.params.id }, { deleted: true, deletedAt: new Date() });
    res.json({ code: "success", message: "Order deleted successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const trash = async (req: Request, res: Response) => {
  const recordList: any = await Order.find({ deleted: true }).select("_id code fullName phone total orderStatus paymentStatus deletedAt").sort({ deletedAt: "desc" });
  res.render("admin/pages/order-trash", { pageTitle: "Order Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    await Order.updateOne({ _id: req.params.id }, { deleted: false });
    res.json({ code: "success", message: "Restored successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    const activeOrder = await Order.findOne({
      _id: req.params.id,
      orderStatus: { $nin: ["cancelled", "returned"] }
    });
    if (activeOrder) {
      res.json({
        code: "error",
        message: "Cannot delete an active order! Please change its status to Cancelled or Returned first."
      });
      return;
    }

    await Order.deleteOne({ _id: req.params.id });
    res.json({ code: "success", message: "Deleted permanently!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const deleteManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }

    const activeOrdersCount = await Order.countDocuments({
      _id: { $in: ids },
      orderStatus: { $nin: ["cancelled", "returned"] },
      deleted: false
    });
    if (activeOrdersCount > 0) {
      res.json({
        code: "error",
        message: "Cannot delete active orders! Please change their status to Cancelled or Returned first."
      });
      return;
    }

    await Order.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
    res.json({ code: "success", message: `Moved ${ids.length} order(s) to trash!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const undoManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await Order.updateMany({ _id: { $in: ids } }, { deleted: false });
    res.json({ code: "success", message: `Restored ${ids.length} order(s)!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const changeMultiPatch = async (req: Request, res: Response) => {
  try {
    const { value, ids } = req.body;
    if (!value || !ids || !ids.length) { res.json({ code: "error", message: "Invalid data!" }); return; }
    switch (value) {
      case "undo":
        await Order.updateMany({ _id: { $in: ids } }, { deleted: false });
        res.json({ code: "success", message: `Restored ${ids.length} order(s)!` });
        break;
      case "destroy": {
        const activeOrdersCount = await Order.countDocuments({
          _id: { $in: ids },
          orderStatus: { $nin: ["cancelled", "returned"] }
        });
        if (activeOrdersCount > 0) {
          res.json({
            code: "error",
            message: "Cannot delete active orders! Please change their status to Cancelled or Returned first."
          });
          return;
        }
        await Order.deleteMany({ _id: { $in: ids } });
        res.json({ code: "success", message: `Permanently deleted ${ids.length} order(s)!` });
        break;
      }
      default:
        res.json({ code: "error", message: "Invalid action!" });
    }
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};
