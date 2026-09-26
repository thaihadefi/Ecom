import "./helpers/test-env";
import { testCourier } from "./helpers/test-courier";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createOrder } from "../services/client/order.service";
import Order from "../models/order.model";
import Product from "../models/product.model";
import Coupon from "../models/coupon.model";
import AccountUser from "../models/account-user.model";
import { resetTestDb, setSetting, startTestDb, stopTestDb } from "./helpers/test-db";
import { checkoutPayload, createCoupon, createProduct, createUser } from "./helpers/fixtures";

before(startTestDb);
after(stopTestDb);

beforeEach(async () => {
  await resetTestDb();
  testCourier.fee = 30000;
  await setSetting("apiPayment", {});
});

describe("checkout", () => {
  it("places a cash order, reserves stock and adds the shipping fee", async () => {
    const product = await createProduct({ stock: 5, priceNew: 100000 });

    const result = await createOrder(checkoutPayload([{ productId: String(product._id), quantity: 2 }]));

    assert.equal(result.success, true, result.message);
    assert.equal(result.total, 230000);
    assert.match(String(result.redirectUrl), /^\/order\/success\?/);

    const order = await Order.findOne({ code: result.orderCode });
    assert.equal(order?.paymentMethod, "money");
    assert.equal(order?.shipping?.provider, "test-courier");
    assert.equal(order?.shipping?.fee, 30000);
    assert.equal(order?.shipping?.cod, 230000);
    assert.equal((await Product.findById(product._id))?.stock, 3);
  });

  it("refuses an order larger than the stock and leaves the stock untouched", async () => {
    const product = await createProduct({ stock: 1 });

    const result = await createOrder(checkoutPayload([{ productId: String(product._id), quantity: 2 }]));

    assert.equal(result.success, false);
    assert.equal(result.status, 409);
    assert.equal((await Product.findById(product._id))?.stock, 1);
    assert.equal(await Order.countDocuments(), 0);
  });

  it("reserves variant stock for the chosen options", async () => {
    const attrId = "attr-size";
    const product = await createProduct({
      stock: 10,
      variants: [
        { status: true, priceNew: 150000, stock: 2, attributeValue: [{ attrId, value: "L" }] },
        { status: true, priceNew: 140000, stock: 8, attributeValue: [{ attrId, value: "M" }] }
      ]
    });

    const result = await createOrder(checkoutPayload([
      { productId: String(product._id), quantity: 2, variant: [{ attrId, label: "L", value: "L" }] } as never
    ]));

    assert.equal(result.success, true, result.message);
    assert.equal(result.total, 2 * 150000 + 30000);
    const saved = await Product.findById(product._id);
    assert.equal(saved?.variants.find((v) => v.attributeValue?.[0]?.value === "L")?.stock, 0);
    assert.equal(saved?.stock, 8);
  });

  it("rejects a payment method whose gateway is not configured", async () => {
    const product = await createProduct();

    const result = await createOrder(checkoutPayload([{ productId: String(product._id), quantity: 1 }], { paymentMethod: "vnpay" }));

    assert.equal(result.success, false);
    assert.equal(result.status, 400);
  });

  it("sends online payments to the gateway once it is configured", async () => {
    await setSetting("apiPayment", { vnPayTmnCode: "TMN", vnPayHashSecret: "secret", vnPayURL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html" });
    const product = await createProduct();

    const result = await createOrder(checkoutPayload([{ productId: String(product._id), quantity: 1 }], { paymentMethod: "vnpay" }));

    assert.equal(result.success, true, result.message);
    assert.match(String(result.redirectUrl), /^\/order\/payment-vnpay\?orderCode=/);
    const order = await Order.findOne({ code: result.orderCode });
    assert.equal(order?.shipping?.cod, 0);
  });

  it("applies a coupon once and enforces its usage limit", async () => {
    const product = await createProduct({ stock: 10, priceNew: 100000 });
    const coupon = await createCoupon({ value: 10, usageLimit: 1 });
    const [first, second] = [await createUser(), await createUser()];
    const items = [{ productId: String(product._id), quantity: 1 }];

    const ok = await createOrder(checkoutPayload(items, { coupon: coupon.code }), { id: String(first._id) });
    assert.equal(ok.success, true, ok.message);
    assert.equal(ok.total, 100000 - 10000 + 30000);

    const refused = await createOrder(checkoutPayload(items, { coupon: coupon.code }), { id: String(second._id) });
    assert.equal(refused.success, false);
    assert.equal((await Coupon.findById(coupon._id))?.usedCount, 1);
    assert.equal((await Product.findById(product._id))?.stock, 9);
  });

  it("spends loyalty points at the value set in Settings > Storefront", async () => {
    await setSetting("storefront", { pointValue: 1000 });
    const product = await createProduct({ priceNew: 100000 });
    const user = await createUser({ totalPoint: 10, usedPoint: 0 });

    const result = await createOrder(
      checkoutPayload([{ productId: String(product._id), quantity: 1 }], { usePoint: true }),
      { id: String(user._id), totalPoint: 10, usedPoint: 0 }
    );

    assert.equal(result.success, true, result.message);
    assert.equal(result.total, 100000 - 10000 + 30000);
    assert.equal((await AccountUser.findById(user._id))?.usedPoint, 10);
  });

  it("sends per-product weight, or the store default, to the courier", async () => {
    await setSetting("apiShipping", { defaultItemWeight: 300 });
    const heavy = await createProduct({ weight: 2000 });
    const light = await createProduct();

    const result = await createOrder(checkoutPayload([
      { productId: String(heavy._id), quantity: 1 },
      { productId: String(light._id), quantity: 2 }
    ]));

    assert.equal(result.success, true, result.message);
    assert.equal(testCourier.lastWeightGrams, 2000 + 2 * 300);
  });
});


describe("shipping providers", () => {
  it("offers GoShip only once its token is set, and only after the map location is known", async () => {
    const { getShippingContext, quoteShippingRates, enabledShippingProviders } = await import("../services/shipping/shipping.service");
    const parcel = { weightGrams: 500, orderValue: 100000, declaredValue: 0, codAmount: 0 };

    await setSetting("apiShipping", { tokenGoShip: "" });
    assert.ok(!enabledShippingProviders(await getShippingContext()).some((p) => p.id === "goship"));

    await setSetting("apiShipping", { tokenGoShip: "token" });
    const ctx = await getShippingContext();
    assert.ok(enabledShippingProviders(ctx).some((p) => p.id === "goship"));
    const rates = await quoteShippingRates({ parcel }, ctx);
    assert.deepEqual(rates.map((r) => r.id), ["test-courier:standard"]);
  });

  it("refuses a rate from an unknown provider", async () => {
    const product = await createProduct();
    const refused = await createOrder(checkoutPayload([{ productId: String(product._id), quantity: 1 }], { shippingMethod: "pickup:store" }));
    assert.equal(refused.success, false);
    assert.equal(refused.status, 400);
  });
});
