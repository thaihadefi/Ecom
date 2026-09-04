import crypto from 'crypto';
import querystring from 'qs';
import moment from 'moment';
import Order from '../../models/order.model';
import { getApiPayment, getGeneral } from '../../configs/setting.config';
import { addPointAfterPayment } from '../../helpers/point.helper';

export const createVNPayPaymentUrl = async (
  orderCode: string,
  phone: string,
  ipAddr: string | string[] | undefined
) => {
  const orderDetail = await Order.findOne({
    code: orderCode,
    phone: phone,
    deleted: false
  });

  if (!orderDetail) return null;

  if (orderDetail.paymentStatus === "paid") {
    return { alreadyPaid: true };
  }

  const date = new Date();
  const createDate = moment(date).format('YYYYMMDDHHmmss');

  const [apiPayment, settingGeneral] = await Promise.all([
    getApiPayment(),
    getGeneral()
  ]);

  const tmnCode = `${apiPayment.vnPayTmnCode}`;
  const secretKey = `${apiPayment.vnPayHashSecret}`;
  let vnpUrl = `${apiPayment.vnPayURL}`;
  const returnUrl = `${settingGeneral.domainWebsite}/order/payment-vnpay-result`;
  const orderId = `${phone}-${orderCode}-${Date.now()}`;
  const amount = (orderDetail.total || 0) * 100;

  let vnp_Params: Record<string, unknown> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId,
    vnp_OrderInfo: 'Payment for transaction:' + orderId,
    vnp_OrderType: 'other',
    vnp_Amount: amount,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate
  };

  vnp_Params = sortObject(vnp_Params);

  const signData = querystring.stringify(vnp_Params, { encode: false });
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
  vnp_Params['vnp_SecureHash'] = signed;
  vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });

  return { paymentUrl: vnpUrl };
};

export const handleVNPayResult = async (queryParams: Record<string, unknown>) => {
  const vnp_Params = { ...queryParams };
  const secureHash = vnp_Params['vnp_SecureHash'];

  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  const sortedParams = sortObject(vnp_Params);

  const apiPayment = await getApiPayment();
  const secretKey = `${apiPayment.vnPayHashSecret}`;

  const signData = querystring.stringify(sortedParams, { encode: false });
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

  const settingGeneral = await getGeneral();
  const domain = settingGeneral.domainWebsite;

  if (secureHash === signed) {
    const [phone, orderCode] = (vnp_Params['vnp_TxnRef'] as string).split('-');
    if (vnp_Params['vnp_ResponseCode'] === '00') {
      const order = await Order.findOneAndUpdate({
        phone: phone,
        code: orderCode,
        paymentStatus: 'unpaid',
        deleted: false
      }, {
        paymentStatus: 'paid'
      });
      if (order) {
        await addPointAfterPayment(orderCode);
      }
    }
    return `${domain}/order/success?orderCode=${orderCode}&phone=${phone}`;
  }
  return `${domain}/`;
};

function sortObject(obj: Record<string, unknown>): Record<string, string> {
  const sorted: Record<string, string> = {};
  const str: string[] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (let i = 0; i < str.length; i++) {
    const decodedKey = decodeURIComponent(str[i]);
    sorted[str[i]] = encodeURIComponent(String(obj[decodedKey] ?? "")).replace(/%20/g, "+");
  }
  return sorted;
}
