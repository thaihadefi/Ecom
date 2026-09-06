import mongoose from 'mongoose';
import { generateRandomNumber, generateRandomString } from '../../helpers/generate.helper';
import Order from '../../models/order.model';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import Coupon from '../../models/coupon.model';
import { getInfoAddress } from '../../helpers/location.helper';
import axios from 'axios';
import { pointConfig } from '../../configs/variable.config';
import AccountUser from '../../models/account-user.model';
import { getApiShipping, getGeneral } from '../../configs/setting.config';
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
  rawVariant?: Array<{ attrId?: string; label?: string; value?: string }>;
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
  usePoint?: boolean | number | string;
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
    Product.find({ _id: { $in: productIds }, deleted: false, status: "active" }).select("_id name priceNew stock images variants"),
    attrIds.length > 0
      ? AttributeProduct.find({ _id: { $in: attrIds } }).select("name")
      : Promise.resolve([])
  ]);

  const productMap = new Map(productList.map((p) => [String(p._id), p]));
  const attributeMap = new Map((attributeList as IAttributeProduct[]).map((a) => [String(a._id), a]));

  const requestedVariantStock = new Map<string, number>();
  const requestedProductStock = new Map<string, number>();

  dataFinal.items = [];
  for (const item of itemsInput) {
    const productDetail = productMap.get(String(item.productId));

    if (productDetail) {
      let price = 0;
      const variant: string[] = [];
      let variantImage: string | undefined;

      if (item.variant && item.variant.length > 0) {
        const variantMatched = (productDetail.variants || []).find((variantItem: { attributeValue?: Array<{ attrId?: string; value?: string }> }) => {
          return (
            (variantItem.attributeValue || []).length === item.variant?.length &&
            (variantItem.attributeValue || []).every((attr) => {
              const selected = item.variant?.find((v) => String(v.attrId) === String(attr.attrId));
              return selected && String(selected.value) === String(attr.value);
            })
          );
        });
        if (!variantMatched) {
          return {
            success: false,
            message: `Invalid variant selected for product: ${productDetail.name}!`
          };
        }
        if ((variantMatched as { status?: boolean }).status === false) {
          return {
            success: false,
            message: `Selected variant for ${productDetail.name} is currently unavailable!`
          };
        }
        const variantStock = typeof (variantMatched as { stock?: number }).stock === "number"
          ? (variantMatched as { stock: number }).stock
          : (typeof productDetail.stock === "number" ? productDetail.stock : 0);

        const variantKey = `${item.productId}_${item.variant.map((v) => `${v.attrId}:${v.value}`).sort().join("_")}`;
        const currentVariantQty = (requestedVariantStock.get(variantKey) || 0) + item.quantity;
        if (variantStock < currentVariantQty) {
          return {
            success: false,
            message: `Selected variant for ${productDetail.name} does not have enough stock!`
          };
        }
        requestedVariantStock.set(variantKey, currentVariantQty);

        price = (variantMatched as { priceNew?: number; price?: number }).priceNew ?? (variantMatched as { priceNew?: number; price?: number }).price ?? (productDetail.priceNew || 0);
        variantImage = (variantMatched as { image?: string }).image;
        for (const v of item.variant) {
          const attribute = attributeMap.get(String(v.attrId));
          if (attribute) variant.push(`${attribute.name}: ${v.label || v.value}`);
        }
      } else {
        if (productDetail.variants && productDetail.variants.length > 0) {
          return {
            success: false,
            message: `Please select product options for: ${productDetail.name}!`
          };
        }
        price = productDetail.priceNew || 0;
      }

      if (typeof productDetail.stock === "number") {
        const currentProductQty = (requestedProductStock.get(String(item.productId)) || 0) + item.quantity;
        if (productDetail.stock < currentProductQty) {
          return {
            success: false,
            message: `Product ${productDetail.name} does not have enough stock!`
          };
        }
        requestedProductStock.set(String(item.productId), currentProductQty);
      }

      dataFinal.items.push({
        productId: item.productId,
        quantity: item.quantity,
        price: price,
        variant: variant.length > 0 ? variant : undefined,
        rawVariant: item.variant && item.variant.length > 0 ? item.variant : undefined,
        image: variantImage || productDetail.images?.[0] || "",
        name: productDetail.name || ""
      });
    }
  }

  
  if (dataFinal.items.length === 0) {
    return { success: false, message: "None of the products in your cart are available anymore." };
  }
  if (dataFinal.items.length < itemsInput.length) {
    return { success: false, message: "Some items are no longer available. Please review your cart and try again." };
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

  const general = await getGeneral();
  const shopLocation = {
    lat: parseFloat(String(general.shopLat || "10.8700089")),
    lng: parseFloat(String(general.shopLng || "106.8030541"))
  };

  const [shopInfoAddress, userInfoAddress] = await Promise.all([
    getInfoAddress(shopLocation.lat, shopLocation.lng),
    getInfoAddress(dataFinal.latitude || 0, dataFinal.longitude || 0)
  ]);

  dataFinal.usedPoint = 0;
  dataFinal.pointDiscount = 0;
  const wantUsePoint = payload.usedPoint ?? payload.usePoint;
  if (accountUser && wantUsePoint) {
    const availablePoint = Math.max(0, (accountUser.totalPoint || 0) - (accountUser.usedPoint || 0));
    const maxPayable = Math.max(0, dataFinal.subTotal - dataFinal.discount);
    const maxPointsNeeded = Math.ceil(maxPayable / pointConfig.POINT_TO_MONEY);

    let requestedPoint = 0;
    if (wantUsePoint === true || wantUsePoint === "true") {
      requestedPoint = Math.min(availablePoint, maxPointsNeeded);
    } else {
      const parsed = parseInt(`${wantUsePoint}`, 10) || 0;
      requestedPoint = Math.max(0, Math.min(parsed, availablePoint, maxPointsNeeded));
    }

    if (requestedPoint > 0) {
      dataFinal.usedPoint = requestedPoint;
      dataFinal.pointDiscount = Math.min(maxPayable, dataFinal.usedPoint * pointConfig.POINT_TO_MONEY);
    }
  }

  const totalWeight = dataFinal.items.reduce((total: number, item) => total + item.quantity * 500, 0);

  const dataGoShip = {
    shipment: {
      rate: payload.shippingMethod,
      payer: dataFinal.paymentMethod === "money" ? 1 : 0,
      address_from: {
        name: String(general.shopSenderName || "Ecom"),
        phone: String(general.shopSenderPhone || "02837252002"),
        street: String(general.shopSenderAddress || "Quarter 34, Linh Xuan Ward, Ho Chi Minh City"),
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
        cod: `${dataFinal.paymentMethod === "money" ? Math.max(0, dataFinal.subTotal - dataFinal.discount - dataFinal.pointDiscount) : 0}`,
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
  const goshipBase = String(apiShipping.goshipApiUrl || "https://sandbox.goship.io/api/v2");

  
  let goshipRes;
  try {
    goshipRes = await axios.post(`${goshipBase}/shipments`, dataGoShip, {
      headers: {
        Authorization: `Bearer ${apiShipping.tokenGoShip}`,
        "Content-Type": "application/json"
      }
    });
  } catch (error: unknown) {
    console.error("[Checkout] GoShip request failed:", error instanceof Error ? error.message : error);
    return { success: false, message: "Unable to calculate the shipping fee. Please recheck your delivery address or try again later." };
  }

  if (typeof goshipRes.data?.fee !== "number") {
    console.error("[Checkout] GoShip returned an unexpected payload:", goshipRes.data);
    return { success: false, message: "The shipping service is temporarily unavailable. Please try again later." };
  }

  dataFinal.shipping = {
    goshipOrderId: goshipRes.data.id,
    carrierName: goshipRes.data.carrier,
    carrierCode: goshipRes.data.carrier_short_name,
    fee: goshipRes.data.fee,
    cod: goshipRes.data.cod,
  };

  dataFinal.total = Math.max(0, dataFinal.subTotal + dataFinal.shipping.fee - dataFinal.discount - dataFinal.pointDiscount);
  if (dataFinal.total === 0) {
    dataFinal.paymentStatus = "paid";
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const item of dataFinal.items) {
        const product = await Product.findOne({
          _id: item.productId,
          deleted: false,
          status: "active"
        }).session(session);

        if (!product) {
          throw Object.assign(new Error("One or more items are out of stock!"), { code: "out_of_stock" });
        }

        if (typeof product.stock === "number") {
          if (product.stock < item.quantity) {
            throw Object.assign(new Error(`Product ${product.name} is out of stock!`), { code: "out_of_stock" });
          }
          product.stock = Math.max(0, product.stock - item.quantity);
        }

        const rawVariant = item.rawVariant;
        if (product.variants && product.variants.length > 0) {
          if (!rawVariant || rawVariant.length === 0) {
            throw Object.assign(new Error(`Please select product options for ${product.name}!`), { code: "out_of_stock" });
          }
          const vMatched = product.variants.find((v) =>
            v.attributeValue &&
            v.attributeValue.length === rawVariant.length &&
            v.attributeValue.every((attr) => {
              const sel = rawVariant.find((s: { attrId?: string; value?: string }) => String(s.attrId) === String(attr.attrId));
              return sel && String(sel.value) === String(attr.value);
            })
          );

          if (!vMatched) {
            throw Object.assign(new Error(`Selected variant for ${product.name} is no longer available!`), { code: "out_of_stock" });
          }

          if (vMatched.status === false) {
            throw Object.assign(new Error(`Selected variant for ${product.name} is currently unavailable!`), { code: "out_of_stock" });
          }

          const variantStock = typeof vMatched.stock === "number"
            ? vMatched.stock
            : (typeof product.stock === "number" ? product.stock : 0);

          if (variantStock < item.quantity) {
            throw Object.assign(new Error(`Selected variant for ${product.name} is out of stock!`), { code: "out_of_stock" });
          }

          vMatched.stock = Math.max(0, variantStock - item.quantity);
          product.markModified("variants");
        }

        await product.save({ session });
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
      return { success: false, message: customErr.message || "One or more items are out of stock!" };
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
      coupon: dataFinal.coupon || undefined,
      usedPoint: dataFinal.usedPoint,
      pointDiscount: dataFinal.pointDiscount,
    }).then(tpl => sendMail(accountUser.email!, tpl.subject, tpl.html))
      .catch(console.error);
  }

  return {
    success: true,
    message: "Order placed successfully!",
    orderCode: dataFinal.code,
    phone: dataFinal.phone,
    total: dataFinal.total,
    paymentStatus: dataFinal.paymentStatus
  };
};

export const getOrderByCodeAndPhone = async (code: string, phone: string) => {
  return Order.findOne({ code, phone, deleted: false });
};
