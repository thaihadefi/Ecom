import axios from 'axios';
import moment from 'moment';
import hmacSHA256 from 'crypto-js/hmac-sha256';
import Order from '../../models/order.model';
import { getApiPayment, getGeneral } from '../../configs/setting.config';
import crypto from 'crypto';
import { applyGatewayPayment } from './payment-order.helper';

const DEFAULT_CREATE_PATH = "/v2/create";

export const resolveZaloPayEndpoint = (configured?: string): string => {
  const raw = (configured || "").trim();
  if (!raw) return `https://sb-openapi.zalopay.vn${DEFAULT_CREATE_PATH}`;
  const url = new URL(raw);
  if (url.pathname === "/" || url.pathname === "") url.pathname = DEFAULT_CREATE_PATH;
  return url.toString();
};

export const createZaloPayPaymentUrl = async (orderCode: string, phone: string) => {
  const orderDetail = await Order.findOne({
    code: orderCode,
    phone: phone,
    orderStatus: { $nin: ["cancelled", "returned"] },
    deleted: false
  });

  if (!orderDetail) return null;

  if (orderDetail.paymentStatus === "paid") {
    return { alreadyPaid: true };
  }

  const [apiPayment, settingGeneral] = await Promise.all([
    getApiPayment(),
    getGeneral()
  ]);

  const config = {
    app_id: `${apiPayment.zaloPayAppId}`,
    key1: `${apiPayment.zaloPayKey1}`,
    key2: `${apiPayment.zaloPayKey2}`,
    endpoint: resolveZaloPayEndpoint(apiPayment.zaloPayEndpoint || apiPayment.zaloPayDomain)
  };

  const embed_data = {
    redirecturl: `${settingGeneral.domainWebsite}/order/success?orderCode=${orderCode}&phone=${phone}`
  };

  const items: unknown[] = [];
  const transID = Math.floor(Math.random() * 1000000);
  const order = {
    app_id: config.app_id,
    app_trans_id: `${moment().format('YYMMDD')}_${transID}`,
    app_user: `${phone}-${orderCode}`,
    app_time: Date.now(),
    item: JSON.stringify(items),
    embed_data: JSON.stringify(embed_data),
    amount: orderDetail.total,
    description: `Payment for order #${orderCode}`,
    bank_code: "",
    callback_url: `${settingGeneral.domainWebsite}/order/payment-zalopay-callback`,
    mac: ""
  };

  const data = config.app_id + "|" + order.app_trans_id + "|" + order.app_user + "|" + order.amount + "|" + order.app_time + "|" + order.embed_data + "|" + order.item;
  order.mac = hmacSHA256(data, config.key1).toString();

  const response = await axios.post(config.endpoint, null, { params: order });

  if (response.data.return_code === 1) {
    return { paymentUrl: response.data.order_url };
  }
  console.error(`[ZaloPay] create order failed: code ${response.data.return_code}, ${response.data.return_message ?? "no message"} (${response.data.sub_return_message ?? "no detail"})`);
  return { paymentUrl: "/" };
};

export const handleZaloPayCallback = async (dataStr: unknown, reqMac: unknown) => {
  if (typeof dataStr !== "string" || typeof reqMac !== "string") {
    return { return_code: -1, return_message: "invalid request" };
  }

  const apiPayment = await getApiPayment();
  const mac = hmacSHA256(dataStr, `${apiPayment.zaloPayKey2}`).toString();

  if (mac.length !== reqMac.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(reqMac))) {
    return { return_code: -1, return_message: "mac not equal" };
  }

  let dataJson: { app_user?: string; amount?: number };
  try {
    dataJson = JSON.parse(dataStr);
  } catch {
    return { return_code: -1, return_message: "invalid data" };
  }

  const [phone, orderCode] = String(dataJson.app_user ?? "").split("-");
  if (!phone || !orderCode) {
    return { return_code: -1, return_message: "order not found" };
  }

  const outcome = await applyGatewayPayment(phone, orderCode, Number(dataJson.amount));
  if (outcome === "not-found" || outcome === "amount-mismatch") {
    console.error(`[ZaloPay] callback rejected for order ${orderCode}: ${outcome}`);
    return { return_code: 2, return_message: outcome };
  }

  return { return_code: 1, return_message: "success" };
};
