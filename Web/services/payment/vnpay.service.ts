import crypto from 'crypto';
import querystring from 'qs';
import { formatInZone } from '../../helpers/timezone.helper';
import Order from '../../models/order.model';
import { getApiPayment, getGeneral } from '../../configs/setting.config';
import { applyGatewayPayment } from './payment-order.helper';

export const createVNPayPaymentUrl = async (
  orderCode: string,
  phone: string,
  ipAddr: string | string[] | undefined
) => {
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

  // VNPay reads vnp_CreateDate as Vietnam time (GMT+7), whatever time zone the server runs in.
  const createDate = formatInZone(new Date(), "Asia/Ho_Chi_Minh", "YYYYMMDDHHmmss");

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

  const vnp_Params: Record<string, unknown> = {
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

  const signedParams: Record<string, string> = {
    ...sortObject(vnp_Params),
    vnp_SecureHash: signVNPayParams(vnp_Params, secretKey)
  };
  vnpUrl += '?' + querystring.stringify(signedParams, { encode: false });

  return { paymentUrl: vnpUrl };
};

// HMAC-SHA512 over the sorted, encoded parameters, as VNPay signs both requests and callbacks.
export const signVNPayParams = (params: Record<string, unknown>, secretKey: string): string => {
  const signData = querystring.stringify(sortObject(params), { encode: false });
  return crypto.createHmac("sha512", secretKey).update(Buffer.from(signData, 'utf-8')).digest("hex");
};

const verifyVNPaySignature = async (queryParams: Record<string, unknown>): Promise<boolean> => {
  const vnp_Params = { ...queryParams };
  const secureHash = vnp_Params['vnp_SecureHash'];

  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  const apiPayment = await getApiPayment();
  const signed = signVNPayParams(vnp_Params, `${apiPayment.vnPayHashSecret}`);

  if (typeof secureHash !== "string" || secureHash.length !== signed.length) return false;
  return crypto.timingSafeEqual(Buffer.from(secureHash.toLowerCase()), Buffer.from(signed));
};

const isSuccessfulTransaction = (params: Record<string, unknown>): boolean =>
  params['vnp_ResponseCode'] === '00' &&
  (params['vnp_TransactionStatus'] === undefined || params['vnp_TransactionStatus'] === '00');

const splitTxnRef = (params: Record<string, unknown>): { phone: string; orderCode: string } | null => {
  const [phone, orderCode] = String(params['vnp_TxnRef'] ?? '').split('-');
  return phone && orderCode ? { phone, orderCode } : null;
};

export const handleVNPayResult = async (queryParams: Record<string, unknown>) => {
  const settingGeneral = await getGeneral();
  // Avoids building the literal string "undefined/..." when the store domain isn't set.
  const domain = settingGeneral.domainWebsite || "";

  if (!(await verifyVNPaySignature(queryParams))) return `${domain}/`;

  const ref = splitTxnRef(queryParams);
  if (!ref) return `${domain}/`;

  if (isSuccessfulTransaction(queryParams)) {
    await applyGatewayPayment(ref.phone, ref.orderCode, Number(queryParams['vnp_Amount']) / 100);
  }
  return `${domain}/order/success?orderCode=${encodeURIComponent(ref.orderCode)}&phone=${encodeURIComponent(ref.phone)}`;
};

export const handleVNPayIpn = async (queryParams: Record<string, unknown>): Promise<{ RspCode: string; Message: string }> => {
  if (!(await verifyVNPaySignature(queryParams))) return { RspCode: '97', Message: 'Invalid signature' };

  const ref = splitTxnRef(queryParams);
  if (!ref) return { RspCode: '01', Message: 'Order not found' };

  if (!isSuccessfulTransaction(queryParams)) return { RspCode: '00', Message: 'Confirm Success' };

  const outcome = await applyGatewayPayment(ref.phone, ref.orderCode, Number(queryParams['vnp_Amount']) / 100);
  switch (outcome) {
    case "not-found": return { RspCode: '01', Message: 'Order not found' };
    case "amount-mismatch": return { RspCode: '04', Message: 'Invalid amount' };
    case "already-paid": return { RspCode: '02', Message: 'Order already confirmed' };
    default: return { RspCode: '00', Message: 'Confirm Success' };
  }
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
