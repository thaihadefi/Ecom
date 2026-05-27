import { Request, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
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

export const createPost = async (req: Request, res: Response) => {
  const dataFinal: any = {};

  // Add userId
  dataFinal.userId = res.locals.accountUser.id || "";

  // Add code
  let code = "";
  let existCode = true;
  while (existCode) {
    code = generateRandomString(2).toUpperCase() + generateRandomNumber(6);
    const existOrderCode = await Order.findOne({
      code: code
    }).select("_id");
    if (!existOrderCode) {
      existCode = false;
    };
  }
  dataFinal.code = code;

  // Add available fields
  dataFinal.fullName = req.body.fullName;
  dataFinal.phone = req.body.phone;
  dataFinal.address = req.body.address;
  dataFinal.longitude = req.body.longitude;
  dataFinal.latitude = req.body.latitude;
  dataFinal.note = req.body.note;
  dataFinal.coupon = req.body.coupon;
  dataFinal.paymentMethod = req.body.paymentMethod;
  dataFinal.paymentStatus = "unpaid";
  dataFinal.orderStatus = "pending";

  // Items array — batch fetch all products and attributes upfront
  const productIds = req.body.items.map((i: any) => i.productId);
  const attrIds = [
    ...new Set(
      req.body.items.flatMap((i: any) => (i.variant || []).map((v: any) => v.attrId))
    )
  ];

  const [productList, attributeList] = await Promise.all([
    Product.find({ _id: { $in: productIds }, deleted: false, status: "active" }).select("_id name priceNew images variants"),
    attrIds.length > 0
      ? AttributeProduct.find({ _id: { $in: attrIds } }).select("name")
      : Promise.resolve([])
  ]);

  const productMap = new Map(productList.map((p: any) => [String(p._id), p]));
  const attributeMap = new Map((attributeList as any[]).map((a: any) => [String(a._id), a]));

  dataFinal.items = [];
  for (const item of req.body.items) {
    const productDetail: any = productMap.get(String(item.productId));

    if(productDetail) {
      let price = 0;
      const variant = [];

      if(item.variant) {
        const variantMatched = productDetail.variants?.find((variantItem: any) => {
          return (
            variantItem.attributeValue.every((attr: any) => {
              const selected = item.variant.find((v: any) => v.attrId === attr.attrId);
              return selected && selected.value === attr.value;
            })
          );
        });
        if (!variantMatched) {
          res.json({
            code: "error",
            message: `Invalid variant selected for product: ${productDetail.name}!`
          });
          return;
        }
        price = variantMatched.priceNew || 0;
        for (const v of item.variant) {
          const attribute: any = attributeMap.get(String(v.attrId));
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
        image: productDetail.images[0],
        name: productDetail.name
      });
    }
  }

  // subTotal field
  dataFinal.subTotal = dataFinal.items.reduce((total: number, item: any) => total + (item.price * item.quantity), 0);

  // discount field
  dataFinal.discount = 0;
  let couponDetail: any = null;
  if(req.body.coupon) {
    couponDetail = await Coupon.findOne({
      code: req.body.coupon.trim(),
      deleted: false,
      status: "active"
    });
    if (!couponDetail) {
      res.json({
        code: "error",
        message: "Coupon does not exist!",
      });
      return;
    }

    // Check if user already used this coupon
    if (res.locals.accountUser) {
      const usedCouponCount = await Order.countDocuments({
        userId: res.locals.accountUser.id,
        coupon: couponDetail.code,
        orderStatus: { $nin: ["cancelled", "returned"] },
        deleted: false
      });
      if (usedCouponCount > 0) {
        res.json({
          code: "error",
          message: "You have already used this coupon code!",
        });
        return;
      }
    }

    // Check validity dates
    const now = new Date();
    if (couponDetail.startDate && now < couponDetail.startDate) {
      res.json({
        code: "error",
        message: "Coupon has not started yet!",
      });
      return;
    }

    if (couponDetail.endDate && now > couponDetail.endDate) {
      res.json({
        code: "error",
        message: "Coupon has expired!",
      });
      return;
    }

    // Check usage limits
    if (
      couponDetail.usageLimit &&
      couponDetail.usedCount >= couponDetail.usageLimit
    ) {
      res.json({
        code: "error",
        message: "Coupon has reached its usage limit!",
      });
      return;
    }

    // Check minimum order value
    if (dataFinal.subTotal >= couponDetail.minOrderValue) {
      if (couponDetail.typeDiscount === "percentage") {
        dataFinal.discount = (dataFinal.subTotal * couponDetail.value) / 100;

        // Apply maximum discount limit if applicable
        if (couponDetail.maxDiscountValue > 0 && dataFinal.discount > couponDetail.maxDiscountValue) {
          dataFinal.discount = couponDetail.maxDiscountValue;
        }

      } else if (couponDetail.typeDiscount === "fixed") {
        dataFinal.discount = couponDetail.value;
      }

      // Store coupon id for atomic update inside transaction
      dataFinal._couponId = couponDetail.id;
      dataFinal._couponUsedCount = couponDetail.usedCount;
    } else {
      // Minimum order value not met
      res.json({
        code: "error",
        message: `Order has not reached the minimum value of ${couponDetail.minOrderValue} VND to apply the coupon.`,
      });
      return;
    }
  }
  // Clamp coupon discount to subTotal
  if (dataFinal.discount > dataFinal.subTotal) {
    dataFinal.discount = dataFinal.subTotal;
  }
  // End discount field

  // shippingMethod field
  // Sender coordinates
  const shopLocation = {
    lat: parseFloat(process.env.SHOP_LAT || "10.8037448"),
    lng: parseFloat(process.env.SHOP_LNG || "106.6617749")
  };

  const [shopInfoAddress, userInfoAddress] = await Promise.all([
    getInfoAddress(shopLocation.lat, shopLocation.lng),
    getInfoAddress(dataFinal.latitude, dataFinal.longitude)
  ]);

  // usedPoint and pointDiscount fields — must be computed before GoShip COD
  dataFinal.usedPoint = 0;
  dataFinal.pointDiscount = 0;
  if(res.locals.accountUser && req.body.usePoint) {
    const availablePoint = res.locals.accountUser.totalPoint - res.locals.accountUser.usedPoint;
    const maxAvailableDiscount = availablePoint * pointConfig.POINT_TO_MONEY;
    const remainingPayable = Math.max(0, dataFinal.subTotal - dataFinal.discount);

    if (maxAvailableDiscount > remainingPayable) {
      // Consume only the points needed to cover the remaining payable product amount
      dataFinal.pointDiscount = remainingPayable;
      dataFinal.usedPoint = Math.ceil(remainingPayable / pointConfig.POINT_TO_MONEY);
    } else {
      // Consume all available points
      dataFinal.usedPoint = Math.max(0, availablePoint);
      dataFinal.pointDiscount = dataFinal.usedPoint * pointConfig.POINT_TO_MONEY;
    }
  }

  // Calculate order total weight (500g per item)
  const totalWeight = dataFinal.items.reduce((total: number, item: any) => total + item.quantity * 500, 0);

  const dataGoShip = {
    shipment: {
      rate: req.body.shippingMethod,
      payer: 0, // Payer: 1: Sender, 0: Receiver
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


  // total field — clamp to 0 to prevent negative totals
  dataFinal.total = Math.max(0, dataFinal.subTotal + dataFinal.shipping.fee - dataFinal.discount - dataFinal.pointDiscount);

  // Wrap stock decrement, coupon update, order creation, and points deduction in a transaction
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Decrement stock for all items
      const stockResults = await Promise.all(
        dataFinal.items.map((item: any) =>
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

      // Update coupon usage atomically if applicable
      if (dataFinal._couponId && couponDetail) {
        const queryCond: any = { _id: dataFinal._couponId, deleted: false, status: "active" };
        if (couponDetail.usageLimit && couponDetail.usageLimit > 0) {
          queryCond.usedCount = { $lt: couponDetail.usageLimit };
        }
        const couponUpdate = await Coupon.updateOne(queryCond, { $inc: { usedCount: 1 } }, { session });
        if (couponUpdate.modifiedCount === 0) {
          throw Object.assign(new Error("Coupon has reached its usage limit!"), { code: "coupon_limit" });
        }
      }

      // Create order
      const newRecord = new Order(dataFinal);
      await newRecord.save({ session });

      // Deduct user points
      if (res.locals.accountUser && dataFinal.usedPoint > 0) {
        await AccountUser.updateOne(
          { _id: res.locals.accountUser.id },
          { $inc: { usedPoint: dataFinal.usedPoint } },
          { session }
        );
      }
    });
  } catch (error: any) {
    if (error.code === "out_of_stock") {
      res.json({ code: "error", message: "One or more items are out of stock!" });
    } else if (error.code === "coupon_limit") {
      res.json({ code: "error", message: "Coupon has reached its usage limit!" });
    } else {
      console.error("Checkout transaction error:", error);
      res.json({ code: "error", message: "An error occurred during checkout. Please try again." });
    }
    return;
  } finally {
    session.endSession();
  }

  // Send confirmation email (non-blocking)
  if (res.locals.accountUser?.email) {
    emailTemplates.orderConfirmation(dataFinal).then(tpl =>
      sendMail(res.locals.accountUser.email, tpl.subject, tpl.html)
    ).catch(console.error);
  }

  res.json({
    code: "success",
    message: "Checkout successful!",
    orderCode: dataFinal.code,
    phone: dataFinal.phone
  })
}

export const success = async (req: Request, res: Response) => {
  const { orderCode, phone } = req.query;

  if(!orderCode || !phone) {
    res.redirect("/");
    return;
  }

  const orderExists = await Order.findOne({
    code: orderCode,
    phone: phone,
    deleted: false
  }).select("_id");

  if(!orderExists) {
    res.redirect("/");
    return;
  }

  res.render("client/pages/order-success", {
    pageTitle: "Checkout successful!",
    orderCode: orderCode,
    phone: phone,
  });
}

export const paymentZaloPay = async (req: Request, res: Response) => {
  const { orderCode, phone } = req.query;

  const orderDetail = await Order.findOne({
    code: orderCode,
    phone: phone,
    deleted: false
  })

  if(!orderDetail) {
    res.redirect("/");
    return;
  }

  if (orderDetail.paymentStatus === "paid") {
    res.redirect(`/order/success?orderCode=${orderCode}&phone=${phone}`);
    return;
  }

  const [apiPayment, settingGeneral] = await Promise.all([
    getApiPayment(),
    getGeneral()
  ]);

  const config = {
    app_id: `${apiPayment.zaloPayAppId}`,
    key1: `${apiPayment.zaloPayKey1}`,
    key2: `${apiPayment.zaloPayKey2}`,
    endpoint: `${apiPayment.zaloPayDomain}/v2/create`
  };

  const embed_data = {
    redirecturl: `${settingGeneral.domainWebsite}/order/success?orderCode=${orderCode}&phone=${phone}`
  };

  const items = [{}];
  const transID = crypto.randomInt(1000000);
  const order = {
    app_id: config.app_id,
    app_trans_id: `${moment().format('YYMMDD')}_${transID}`,
    app_user: `${phone}-${orderCode}`,
    app_time: Date.now(), // Milliseconds
    item: JSON.stringify(items),
    embed_data: JSON.stringify(embed_data),
    amount: orderDetail.total,
    description: `Payment for order ${orderCode}`,
    bank_code: "",
    mac: "",
    callback_url: `${settingGeneral.domainWebsite}/order/payment-zalopay-result`
  };

  // appid|app_trans_id|appuser|amount|apptime|embeddata|item
  const data = config.app_id + "|" + order.app_trans_id + "|" + order.app_user + "|" + order.amount + "|" + order.app_time + "|" + order.embed_data + "|" + order.item;
  order.mac = hmacSHA256(data, config.key1).toString();

  try {
    const response = await axios.post(config.endpoint, null, { params: order });
    if (!response.data?.order_url) {
      res.redirect(`/order/success?orderCode=${orderCode}&phone=${phone}`);
      return;
    }
    res.redirect(response.data.order_url);
  } catch (error) {
    console.error("ZaloPay API error:", error);
    res.redirect(`/order/success?orderCode=${orderCode}&phone=${phone}`);
  }
}

export const paymentZalopayResult = async (req: Request, res: Response) => {
  const apiPayment = await getApiPayment();
  
  const config = {
    key2: `${apiPayment.zaloPayKey2}`
  };
  
  let result: any = {};

  try {
    let dataStr = req.body.data;
    let reqMac = req.body.mac;

    let mac = hmacSHA256(dataStr, config.key2).toString();

    // Verify callback origin (from ZaloPay server)
    if (reqMac !== mac) {
      // Invalid callback
      result.return_code = -1;
      result.return_message = "mac not equal";
    }
    else {
      // Payment successful
      // Merchant updates order status
      let dataJson = JSON.parse(dataStr);

      // Update order status
      const [phone, orderCode] = dataJson.app_user.split("-");
      const order = await Order.findOneAndUpdate({
        phone: phone,
        code: orderCode,
        paymentStatus: "unpaid",
        deleted: false
      }, {
        paymentStatus: "paid"
      });

      if (order) {
        // Reward points
        await addPointAfterPayment(orderCode);
        // End Reward points
      }

      result.return_code = 1;
      result.return_message = "success";
    }
  } catch (ex: any) {
    result.return_code = 0; // ZaloPay server will callback again (up to 3 times)
    result.return_message = ex.message;
  }

  // Notify ZaloPay server of the result
  res.json(result);
}

export const paymentVNPay = async (req: Request, res: Response) => {
  const { orderCode, phone } = req.query;

  const orderDetail = await Order.findOne({
    code: orderCode,
    phone: phone,
    deleted: false
  })

  if(!orderDetail) {
    res.redirect("/");
    return;
  }

  if (orderDetail.paymentStatus === "paid") {
    res.redirect(`/order/success?orderCode=${orderCode}&phone=${phone}`);
    return;
  }

  let date = new Date();
  let createDate = moment(date).format('YYYYMMDDHHmmss');
  
  let ipAddr = req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress;
  
  const [apiPayment, settingGeneral] = await Promise.all([
    getApiPayment(),
    getGeneral()
  ]);

  let tmnCode = `${apiPayment.vnPayTmnCode}`;
  let secretKey = `${apiPayment.vnPayHashSecret}`;
  let vnpUrl = `${apiPayment.vnPayURL}`;
  let returnUrl = `${settingGeneral.domainWebsite}/order/payment-vnpay-result`;
  let orderId = `${phone}-${orderCode}-${Date.now()}`;
  let amount = orderDetail.total || 0;
  let bankCode = "";
  
  let locale = 'vn';
  let currCode = 'VND';
  let vnp_Params: any = {};
  vnp_Params['vnp_Version'] = '2.1.0';
  vnp_Params['vnp_Command'] = 'pay';
  vnp_Params['vnp_TmnCode'] = tmnCode;
  vnp_Params['vnp_Locale'] = locale;
  vnp_Params['vnp_CurrCode'] = currCode;
  vnp_Params['vnp_TxnRef'] = orderId;
  vnp_Params['vnp_OrderInfo'] = 'Payment for transaction:' + orderId;
  vnp_Params['vnp_OrderType'] = 'other';
  vnp_Params['vnp_Amount'] = amount * 100;
  vnp_Params['vnp_ReturnUrl'] = returnUrl;
  vnp_Params['vnp_IpAddr'] = ipAddr;
  vnp_Params['vnp_CreateDate'] = createDate;
  if(bankCode !== null && bankCode !== ''){
    vnp_Params['vnp_BankCode'] = bankCode;
  }

  vnp_Params = sortObject(vnp_Params);

  let querystring = require('qs');
  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", secretKey);
  let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
  vnp_Params['vnp_SecureHash'] = signed;
  vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });

  res.redirect(vnpUrl);
}

export const paymentVNPayResult = async (req: Request, res: Response) => {
  let vnp_Params = req.query;

  let secureHash = vnp_Params['vnp_SecureHash'];

  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  vnp_Params = sortObject(vnp_Params);

  const apiPayment = await getApiPayment();

  let secretKey = `${apiPayment.vnPayHashSecret}`;

  let querystring = require('qs');
  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", secretKey);
  let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");    

  if(secureHash === signed){
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
      const settingGeneral = await getGeneral();
      res.redirect(`${settingGeneral.domainWebsite}/order/success?orderCode=${orderCode}&phone=${phone}`);
    } else {
      res.render('success', { code: vnp_Params['vnp_ResponseCode'] });
    }
  } else{
    res.render('success', {code: '97'})
  }
}

function sortObject(obj: any) {
  let sorted: any = {};
  let str: string[] = [];
  for (let key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (let i = 0; i < str.length; i++) {
    const decodedKey = decodeURIComponent(str[i]);
    sorted[str[i]] = encodeURIComponent(obj[decodedKey]).replace(/%20/g, "+");
  }
  return sorted;
}