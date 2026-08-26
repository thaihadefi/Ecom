import mongoose from 'mongoose';
import crypto from 'crypto';
import querystring from 'qs';
import { generateRandomNumber, generateRandomString } from '../../helpers/generate.helper';
import Order from '../../models/order.model';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import Coupon from '../../models/coupon.model';
import { getInfoAddress } from '../../helpers/location.helper';
import axios from 'axios';
import moment from 'moment';
import hmacSHA256 from 'crypto-js/hmac-sha256';
import { addPointAfterPayment } from '../../helpers/point.helper';
import { pointConfig } from '../../configs/variable.config';
import AccountUser from '../../models/account-user.model';
import { getApiPayment, getApiShipping, getGeneral } from '../../configs/setting.config';
import { sendMail, emailTemplates } from '../../helpers/mail.helper';
import { ICoupon } from '../../interfaces/models/coupon.interface';
import { IAttributeProduct } from '../../interfaces/models/attribute-product.interface';

export interface OrderItemInput {
  productId: string;
  quantity: number;
  variant?: Array<{ attrId: string; label: string; value: string }>;
}

export interface OrderItemFinal {
  productId: string;
  quantity: number;
  price: number;
  variant?: string[];
  image?: string;
  name: string;
}

export interface CreateOrderPayload {
  fullName?: string;
  phone?: string;
  address?: string;
  longitude?: number;
  latitude?: number;
  note?: string;
  coupon?: string;
  paymentMethod?: string;
  shippingMethod?: string;
  items?: OrderItemInput[];
  usedPoint?: unknown;
}

export const createOrder = async (
  payload: CreateOrderPayload,
  accountUser?: { id?: string; email?: string; totalPoint?: number; usedPoint?: number }
) => {
  const dataFinal: {
    userId?: string;
    code?: string;
    fullName?: string;
    phone?: string;
    address?: string;
    longitude?: number;
    latitude?: number;
    note?: string;
    coupon?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    orderStatus?: string;
    items: OrderItemFinal[];
    subTotal: number;
    discount: number;
    _couponId?: string;
    usedPoint: number;
    pointDiscount: number;
    shipping: {
      goshipOrderId?: string;
      carrierName?: string;
      carrierCode?: string;
      fee: number;
      cod?: number;
    };
    total: number;
  } = {
    items: [],
    subTotal: 0,
    discount: 0,
    usedPoint: 0,
    pointDiscount: 0,
    shipping: { fee: 0 },
    total: 0
  };

  dataFinal.userId = accountUser?.id || "";

  let code = "";
  let existCode = true;
  while (existCode) {
    code = generateRandomString(2).toUpperCase() + generateRandomNumber(6);
    const existOrderCode = await Order.findOne({ code }).select("_id");
    if (!existOrderCode) {
      existCode = false;
    }
  }
  dataFinal.code = code;

  dataFinal.fullName = payload.fullName;
  dataFinal.phone = payload.phone;
  dataFinal.address = payload.address;
  dataFinal.longitude = payload.longitude;
  dataFinal.latitude = payload.latitude;
  dataFinal.note = payload.note;
  dataFinal.coupon = payload.coupon;
  dataFinal.paymentMethod = payload.paymentMethod;
  dataFinal.paymentStatus = "unpaid";
  dataFinal.orderStatus = "pending";

  const itemsInput: OrderItemInput[] = payload.items || [];
  const productIds = itemsInput.map((i) => i.productId);
  const attrIds = [
    ...new Set(
      itemsInput.flatMap((i) => (i.variant || []).map((v) => v.attrId))
    )
  ];

  const [productList, attributeList] = await Promise.all([
    Product.find({ _id: { $in: productIds }, deleted: false, status: "active" }).select("_id name priceNew images variants"),
    attrIds.length > 0
      ? AttributeProduct.find({ _id: { $in: attrIds } }).select("name")
      : Promise.resolve([])
  ]);

  const productMap = new Map(productList.map((p) => [String(p._id), p]));
  const attributeMap = new Map((attributeList as IAttributeProduct[]).map((a) => [String(a._id), a]));

  dataFinal.items = [];
  for (const item of itemsInput) {
    const productDetail = productMap.get(String(item.productId));

    if (productDetail) {
      let price = 0;
      const variant: string[] = [];

      if (item.variant && item.variant.length > 0) {
        const variantMatched = (productDetail.variants || []).find((variantItem: { attributeValue?: Array<{ attrId?: string; value?: string }> }) => {
          return (
            (variantItem.attributeValue || []).every((attr) => {
              const selected = item.variant?.find((v) => v.attrId === attr.attrId);
              return selected && selected.value === attr.value;
            })
          );
        });
        if (!variantMatched) {
          return {
            success: false,
            message: `Invalid variant selected for product: ${productDetail.name}!`
          };
        }
        price = variantMatched.price ?? 0;
        for (const v of item.variant) {
          const attribute = attributeMap.get(String(v.attrId));
          if (attribute) variant.push(`${attribute.name}: ${v.label}`);
        }
      } else {
        price = productDetail.priceNew || 0;
      }

      dataFinal.items.push({
        productId: item.productId,
        quantity: item.quantity,
        price: price,
        variant: variant.length > 0 ? variant : undefined,
        image: productDetail.images?.[0] || "",
        name: productDetail.name || ""
      });
    }
  }

  dataFinal.subTotal = dataFinal.items.reduce((total: number, item) => total + (item.price * item.quantity), 0);

  dataFinal.discount = 0;
  let couponDetail: ICoupon | null = null;
  if (payload.coupon) {
    couponDetail = await Coupon.findOne({
      code: payload.coupon.trim(),
      deleted: false,
      status: "active"
    });

    if (!couponDetail) {
      return { success: false, message: "Invalid coupon code!" };
    }

    if (couponDetail.usageLimit && couponDetail.usageLimit > 0 && couponDetail.usedCount >= couponDetail.usageLimit) {
      return { success: false, message: "Coupon has reached its usage limit!" };
    }

    if (couponDetail.minOrderValue && dataFinal.subTotal < couponDetail.minOrderValue) {
      return {
        success: false,
        message: `Order must be at least ${couponDetail.minOrderValue.toLocaleString()}đ to use this coupon!`
      };
    }

    if (couponDetail.typeDiscount === "percentage") {
      const discountValue = Math.round((dataFinal.subTotal * (couponDetail.value || 0)) / 100);
      dataFinal.discount = couponDetail.maxDiscountValue && couponDetail.maxDiscountValue > 0
        ? Math.min(discountValue, couponDetail.maxDiscountValue)
        : discountValue;
    } else {
      dataFinal.discount = Math.min(couponDetail.value || 0, dataFinal.subTotal);
    }

    dataFinal._couponId = String(couponDetail._id);
  }

  const shopLocation = {
    lat: parseFloat(process.env.SHOP_LAT || "10.8700089"),
    lng: parseFloat(process.env.SHOP_LNG || "106.8030541")
  };

  const [shopInfoAddress, userInfoAddress] = await Promise.all([
    getInfoAddress(shopLocation.lat, shopLocation.lng),
    getInfoAddress(dataFinal.latitude || 0, dataFinal.longitude || 0)
  ]);

  dataFinal.usedPoint = 0;
  dataFinal.pointDiscount = 0;
  if (accountUser && payload.usedPoint) {
    const requestedPoint = parseInt(`${payload.usedPoint}`) || 0;
    const availablePoint = (accountUser.totalPoint || 0) - (accountUser.usedPoint || 0);
    if (requestedPoint > 0 && requestedPoint <= availablePoint) {
      dataFinal.usedPoint = requestedPoint;
      dataFinal.pointDiscount = dataFinal.usedPoint * pointConfig.POINT_TO_MONEY;
    }
  }

  const totalWeight = dataFinal.items.reduce((total: number, item) => total + item.quantity * 500, 0);

  const dataGoShip = {
    shipment: {
      rate: payload.shippingMethod,
      payer: 0,
      address_from: {
        name: process.env.SHOP_SENDER_NAME || "",
        phone: process.env.SHOP_SENDER_PHONE || "",
        street: process.env.SHOP_SENDER_ADDRESS || "",
        city: shopInfoAddress.city,
        district: shopInfoAddress.district,
        ward: shopInfoAddress.ward
      },
      address_to: {
        name: dataFinal.fullName,
        phone: dataFinal.phone,
        street: dataFinal.address,
        city: userInfoAddress.city,
        district: userInfoAddress.district,
        ward: userInfoAddress.ward
      },
      parcel: {
        cod: `${Math.max(0, dataFinal.subTotal - dataFinal.discount - dataFinal.pointDiscount)}`,
        amount: `${Math.max(0, dataFinal.subTotal - dataFinal.discount - dataFinal.pointDiscount)}`,
        weight: `${totalWeight}`,
        width: "10",
        height: "10",
        length: "10",
        metadata: "Fragile items, please handle with care."
      }
    }
  };

  const apiShipping = await getApiShipping();

  const goshipRes = await axios.post(`${process.env.GOSHIP_API_URL || "https://sandbox.goship.io/api/v2"}/shipments`, dataGoShip, {
    headers: {
      Authorization: `Bearer ${apiShipping.tokenGoShip}`,
      "Content-Type": "application/json"
    }
  });

  dataFinal.shipping = {
    goshipOrderId: goshipRes.data.id,
    carrierName: goshipRes.data.carrier,
    carrierCode: goshipRes.data.carrier_short_name,
    fee: goshipRes.data.fee,
    cod: goshipRes.data.cod,
  };

  dataFinal.total = Math.max(0, dataFinal.subTotal + dataFinal.shipping.fee - dataFinal.discount - dataFinal.pointDiscount);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const stockResults = await Promise.all(
        dataFinal.items.map((item) =>
          Product.updateOne(
            { _id: item.productId, deleted: false, status: "active", stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } },
            { session }
          )
        )
      );

      const failedStock = stockResults.filter(r => r.modifiedCount !== 1);
      if (failedStock.length > 0) {
        throw Object.assign(new Error("One or more items are out of stock!"), { code: "out_of_stock" });
      }

      if (dataFinal._couponId && couponDetail) {
        const queryCond: Record<string, unknown> = { _id: dataFinal._couponId, deleted: false, status: "active" };
        if (couponDetail.usageLimit && couponDetail.usageLimit > 0) {
          queryCond.usedCount = { $lt: couponDetail.usageLimit };
        }
        const couponUpdate = await Coupon.updateOne(queryCond, { $inc: { usedCount: 1 } }, { session });
        if (couponUpdate.modifiedCount === 0) {
          throw Object.assign(new Error("Coupon has reached its usage limit!"), { code: "coupon_limit" });
        }
      }

      const newRecord = new Order(dataFinal);
      await newRecord.save({ session });

      if (accountUser?.id && dataFinal.usedPoint > 0) {
        await AccountUser.updateOne(
          { _id: accountUser.id },
          { $inc: { usedPoint: dataFinal.usedPoint } },
          { session }
        );
      }
    });
  } catch (error: unknown) {
    const customErr = error as { code?: string; message?: string };
    if (customErr?.code === "out_of_stock") {
      return { success: false, message: "One or more items are out of stock!" };
    } else if (customErr?.code === "coupon_limit") {
      return { success: false, message: "Coupon has reached its usage limit!" };
    } else {
      console.error("Checkout transaction error:", error);
      return { success: false, message: "An error occurred during checkout. Please try again." };
    }
  } finally {
    session.endSession();
  }

  if (accountUser?.email) {
    emailTemplates.orderConfirmation({
      code: dataFinal.code || "",
      fullName: dataFinal.fullName || "",
      address: dataFinal.address || "",
      items: dataFinal.items,
      subTotal: dataFinal.subTotal,
      discount: dataFinal.discount,
      shipping: dataFinal.shipping,
      total: dataFinal.total,
      paymentMethod: dataFinal.paymentMethod || "",
      coupon: dataFinal.coupon || undefined
    }).then(tpl => sendMail(accountUser.email!, tpl.subject, tpl.html))
      .catch(console.error);
  }

  return {
    success: true,
    message: "Order placed successfully!",
    orderCode: dataFinal.code,
    phone: dataFinal.phone
  };
};

export const getOrderByCodeAndPhone = async (code: string, phone: string) => {
  return Order.findOne({ code, phone, deleted: false });
};

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
    endpoint: `${apiPayment.zaloPayEndpoint}`
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
