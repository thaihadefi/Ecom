import { safeCsvOptions, toCsvRows } from "../../helpers/csv.helper";
import { Request, Response } from 'express';
import { pathAdmin } from '../../configs/variable.config';
import { Parser } from 'json2csv';
import { logAdminAction } from '../../helpers/log.helper';
import * as orderService from '../../services/admin/order.service';
import * as anomalyDetectionService from '../../services/admin/anomaly-detection.service';
import { resultStatus, sendCaughtError } from "../../helpers/http-response.helper";

export const list = async (req: Request, res: Response) => {
  const data = await orderService.getOrderList(req.query.keyword, req.query.page);

  res.render("admin/pages/order-list", {
    pageTitle: "Order Management",
    ...data
  });
};

export const flaggedList = async (req: Request, res: Response) => {
  const { recordList, pagination } = await anomalyDetectionService.getFlaggedOrders(req.query.page);

  res.render("admin/pages/order-flagged-list", {
    pageTitle: "Flagged Orders (Bot/Scalper Detection)",
    flaggedOrders: recordList,
    pagination
  });
};

export const dismissAnomalyPost = async (req: Request, res: Response) => {
  try {
    const result = await anomalyDetectionService.dismissAnomalyFlag(req.params.id);
    if (!result.dismissed) {
      res.status(404).json({ code: "error", message: "Order not found or already dismissed!" });
      return;
    }
    logAdminAction(req, `Dismissed anomaly flag on order (Id: ${req.params.id})`);
    res.json({ code: "success", message: "Flag dismissed. This order won't show in the review queue anymore." });
  } catch (error) {
    console.error("dismissAnomalyPost error:", error);
    sendCaughtError(res, error, "Failed to dismiss flag!", "Failed to dismiss flag!");
  }
};

export const retrainAnomalyModelPost = async (req: Request, res: Response) => {
  const status = anomalyDetectionService.triggerManualRetrain();
  logAdminAction(req, "Triggered anomaly model retrain (running in background)");
  res.json({
    code: "success",
    message: status.status === "running" ? "Retrain started." : "A retrain is already in progress.",
    status
  });
};

export const retrainAnomalyModelStatus = async (_req: Request, res: Response) => {
  res.json({ code: "success", status: anomalyDetectionService.getManualRetrainStatus() });
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
      res.status(resultStatus(result)).json({
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
    sendCaughtError(res, error, "An error occurred, please try again!", "An error occurred, please try again!");
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
    const parser = new Parser({ header: true, ...safeCsvOptions });

    while (true) {
      const batch = await orderService.getOrdersBatchForExport(skip, BATCH);
      if (!batch.length) break;

      let csv = parser.parse(toCsvRows(batch));
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
    if (res.headersSent) {
      res.end();
    } else {
      res.status(500).json({ code: "error", message: "Export failed!" });
    }
  }
};

export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.status(400).json({ code: "error", message: "No items selected!" });
      return;
    }

    const result = await orderService.permanentlyDeleteManyOrders(ids);
    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("destroyManyDelete error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const result = await orderService.softDeleteOrder(req.params.id);
    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("deletePatch error:", error);
    sendCaughtError(res, error, "Invalid ID!");
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
    sendCaughtError(res, error, "Invalid ID!");
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    const result = await orderService.permanentlyDeleteOrder(req.params.id);
    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("destroyDelete error:", error);
    sendCaughtError(res, error, "Invalid ID!");
  }
};

export const deleteManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.status(400).json({ code: "error", message: "No items selected!" });
      return;
    }

    const result = await orderService.softDeleteManyOrders(ids);
    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("deleteManyPatch error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const undoManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.status(400).json({ code: "error", message: "No items selected!" });
      return;
    }

    const result = await orderService.restoreManyOrders(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoManyPatch error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};
