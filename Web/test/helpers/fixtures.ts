import AccountUser from "../../models/account-user.model";
import Coupon from "../../models/coupon.model";
import Product from "../../models/product.model";

let counter = 0;
const unique = () => `${Date.now()}-${++counter}`;

export const createProduct = async (fields: Record<string, unknown> = {}) =>
  Product.create({
    name: `Test product ${unique()}`,
    slug: `test-product-${unique()}`,
    priceOld: 120000,
    priceNew: 100000,
    stock: 5,
    status: "active",
    deleted: false,
    category: [],
    images: [],
    ...fields
  });

export const createUser = async (fields: Record<string, unknown> = {}) =>
  AccountUser.create({
    fullName: "Test Customer",
    email: `customer-${unique()}@example.test`,
    status: "active",
    deleted: false,
    totalPoint: 0,
    usedPoint: 0,
    ...fields
  });

export const createCoupon = async (fields: Record<string, unknown> = {}) =>
  Coupon.create({
    code: `SAVE${counter + 1}`,
    typeDiscount: "percentage",
    value: 10,
    status: "active",
    deleted: false,
    usedCount: 0,
    ...fields
  });

export const checkoutPayload = (items: Array<{ productId: string; quantity: number }>, fields: Record<string, unknown> = {}) => ({
  fullName: "Test Customer",
  phone: "0912345678",
  address: "1 Test Street",
  latitude: 10.77,
  longitude: 106.7,
  items,
  paymentMethod: "money",
  shippingMethod: "test-courier:standard",
  ...fields
});
