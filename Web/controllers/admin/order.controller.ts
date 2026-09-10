import { Request, Response } from 'express';
import { pathAdmin } from '../../configs/variable.config';
import { Parser } from 'json2csv';
import { logAdminAction } from '../../helpers/log.helper';
import * as orderService from '../../services/admin/order.service';

export const list = async (req: Request, res: Response) => {
  const data = await orderService.getOrderList(req.query.keyword, req.query.page);

  res.render("admin/pages/order-list", {
    pageTitle: "Order Management",
    ...data
  });
};

export const edit = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const orderDetail = await orderService.getOrderDetailById(id);

    if (!orderDetail) {
      res.redirect(`/${pathAdmin}/order/list`);
      return;
    }

    res.render("admin/pages/order-edit", {
      pageTitle: "Edit Order",
      orderDetail: orderDetail
    });
  } catch (error) {
    console.error("order edit error:", error);
    res.redirect(`/${pathAdmin}/order/list`);
  }
};

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { orderStatus, paymentStatus, note } = req.body;

    const result = await orderService.updateOrderAdmin(id, orderStatus, paymentStatus, note);

    if (!result.success) {
      res.json({
        code: "error",
        message: result.message
      });
      return;
    }

    logAdminAction(req, `Updated order #${result.order?.code || id} (Status: ${orderStatus}, Payment: ${paymentStatus})`);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("order editPatch error:", error);
    res.json({
      code: "error",
      message: "An error occurred, please try again!"
    });
  }
};

export const exportCSV = async (_req: Request, res: Response) => {
  try {
    res.header("Content-Type", "text/csv");
    res.attachment("orders.csv");
    res.write("\uFEFF");

    const BATCH = 500;
    let skip = 0;
    let headerWritten = false;
    const parser = new Parser({ header: true });

    while (true) {
      const batch = await orderService.getOrdersBatchForExport(skip, BATCH);
      if (!batch.length) break;

      let csv = parser.parse(batch);
      if (headerWritten) {
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
};

export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }

    const result = await orderService.permanentlyDeleteManyOrders(ids);
    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("destroyManyDelete error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const result = await orderService.softDeleteOrder(req.params.id);
    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("deletePatch error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const trash = async (_req: Request, res: Response) => {
  const recordList = await orderService.getOrderTrash();
  res.render("admin/pages/order-trash", { pageTitle: "Order Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    const result = await orderService.restoreOrder(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoPatch error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    const result = await orderService.permanentlyDeleteOrder(req.params.id);
    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("destroyDelete error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const deleteManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }

    const result = await orderService.softDeleteManyOrders(ids);
    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("deleteManyPatch error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const undoManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }

    const result = await orderService.restoreManyOrders(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoManyPatch error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const changeMultiPatch = async (req: Request, res: Response) => {
  try {
    const { value, ids } = req.body;
    if (!value || !ids || !ids.length) {
      res.json({ code: "error", message: "Invalid data!" });
      return;
    }
    switch (value) {
      case "undo": {
        const result = await orderService.restoreManyOrders(ids);
        res.json({ code: "success", message: result.message });
        break;
      }
      case "destroy": {
        const result = await orderService.permanentlyDeleteManyOrders(ids);
        res.json({
          code: result.success ? "success" : "error",
          message: result.message
        });
        break;
      }
      default:
        res.json({ code: "error", message: "Invalid action!" });
    }
  } catch (error) {
    console.error("changeMultiPatch error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};
