import { Request, Response } from 'express';
import * as orderService from '../../services/client/order.service';

export const createPost = async (req: Request, res: Response) => {
  try {
    const result = await orderService.createOrder(req.body, res.locals.accountUser);

    if (!result.success) {
      res.json({
        code: "error",
        message: result.message
      });
      return;
    }

    res.json({
      code: "success",
      message: result.message,
      orderCode: result.orderCode,
      phone: result.phone
    });
  } catch (error) {
    console.error("order createPost error:", error);
    res.json({
      code: "error",
      message: "An error occurred during checkout. Please try again."
    });
  }
};

export const success = async (req: Request, res: Response) => {
  const { orderCode, phone } = req.query;

  const orderDetail = await orderService.getOrderByCodeAndPhone(String(orderCode), String(phone));

  if (!orderDetail) {
    res.redirect("/");
    return;
  }

  res.render("client/pages/order-success", {
    pageTitle: "Order Success",
    orderDetail: orderDetail
  });
};

export const paymentZaloPay = async (req: Request, res: Response) => {
  const { orderCode, phone } = req.query;

  const result = await orderService.createZaloPayPaymentUrl(String(orderCode), String(phone));

  if (!result) {
    res.redirect("/");
    return;
  }

  if (result.alreadyPaid) {
    res.redirect(`/order/success?orderCode=${orderCode}&phone=${phone}`);
    return;
  }

  res.redirect(result.paymentUrl || "/");
};

export const paymentZalopayResult = async (req: Request, res: Response) => {
  try {
    const result = await orderService.handleZaloPayCallback(req.body.data, req.body.mac);
    res.json(result);
  } catch (ex: unknown) {
    const errorMessage = ex instanceof Error ? ex.message : "ZaloPay callback error";
    res.json({ return_code: 0, return_message: errorMessage });
  }
};

export const paymentVNPay = async (req: Request, res: Response) => {
  const { orderCode, phone } = req.query;
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ipAddr = Array.isArray(rawIp) ? rawIp[0] : (typeof rawIp === "string" ? rawIp.split(',')[0].trim() : undefined);

  const result = await orderService.createVNPayPaymentUrl(String(orderCode), String(phone), ipAddr);

  if (!result) {
    res.redirect("/");
    return;
  }

  if (result.alreadyPaid) {
    res.redirect(`/order/success?orderCode=${orderCode}&phone=${phone}`);
    return;
  }

  res.redirect(result.paymentUrl || "/");
};

export const paymentVNPayResult = async (req: Request, res: Response) => {
  try {
    const redirectUrl = await orderService.handleVNPayResult(req.query as Record<string, unknown>);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("paymentVNPayResult error:", error);
    res.redirect("/");
  }
};
