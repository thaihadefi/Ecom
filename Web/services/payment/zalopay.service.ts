import axios from 'axios';
import moment from 'moment';
import hmacSHA256 from 'crypto-js/hmac-sha256';
import Order from '../../models/order.model';
import { getApiPayment, getGeneral } from '../../configs/setting.config';
import { addPointAfterPayment } from '../../helpers/point.helper';

export const createZaloPayPaymentUrl = async (orderCode: string, phone: string) => {
  const orderDetail = await Order.findOne({
    code: orderCode,
    phone: phone,
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
    endpoint: `${apiPayment.zaloPayDomain || apiPayment.zaloPayEndpoint || "https://sb-openapi.zalopay.vn/v2/create"}`
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
  return { paymentUrl: "/" };
};

export const handleZaloPayCallback = async (dataStr: string, reqMac: string) => {
  const apiPayment = await getApiPayment();
  const config = { key2: `${apiPayment.zaloPayKey2}` };
  const mac = hmacSHA256(dataStr, config.key2).toString();

  if (reqMac !== mac) {
    return { return_code: -1, return_message: "mac not equal" };
  }

  const dataJson = JSON.parse(dataStr);
  const [phone, orderCode] = dataJson.app_user.split("-");
  const order = await Order.findOneAndUpdate(
    { phone, code: orderCode, paymentStatus: "unpaid", deleted: false },
    { paymentStatus: "paid" }
  );

  if (order) {
    await addPointAfterPayment(orderCode);
  }

  return { return_code: 1, return_message: "success" };
};
