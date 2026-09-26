import "./helpers/test-env";
import { testCourier } from "./helpers/test-courier";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createOrder } from "../services/client/order.service";
import { applyGatewayPayment } from "../services/payment/payment-order.helper";
import { createVNPayPaymentUrl, handleVNPayIpn, signVNPayParams } from "../services/payment/vnpay.service";
import { startGatewayPayment } from "../services/payment/payment-gateway.service";
import { enabledPaymentMethods, PAYMENT_METHOD_IDS } from "../configs/payment-methods.config";
import Order from "../models/order.model";
import AccountUser from "../models/account-user.model";
import { resetTestDb, setSetting, startTestDb, stopTestDb } from "./helpers/test-db";
import { checkoutPayload, createProduct, createUser } from "./helpers/fixtures";

const VNPAY = { vnPayTmnCode: "TMN", vnPayHashSecret: "vnpay-secret", vnPayURL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html" };

before(startTestDb);
after(stopTestDb);

beforeEach(async () => {
  await resetTestDb();
  testCourier.fee = 0;
  await setSetting("apiPayment", VNPAY);
  await setSetting("general", { domainWebsite: "https://shop.example.test" });
});

const placeVnpayOrder = async (userId?: string) => {
  const product = await createProduct({ priceNew: 250000 });
  const result = await createOrder(
    checkoutPayload([{ productId: String(product._id), quantity: 1 }], { paymentMethod: "vnpay" }),
    userId ? { id: userId } : undefined
  );
  assert.equal(result.success, true, result.message);
  return result;
};

describe("payment methods", () => {
  it("offers only configured methods, narrowed by the store's choice", () => {
    assert.deepEqual(enabledPaymentMethods({}).map((m) => m.id), ["money"]);
    assert.deepEqual(enabledPaymentMethods(VNPAY).map((m) => m.id), ["money", "vnpay"]);
    assert.deepEqual(enabledPaymentMethods({ ...VNPAY, enabledMethods: ["vnpay"] }).map((m) => m.id), ["vnpay"]);
    assert.ok(PAYMENT_METHOD_IDS.includes("zalopay"));
  });

  it("hides VND-only gateways when the store sells in another currency", async () => {
    await setSetting("storefront", { currency: "USD", locale: "en-US" });
    assert.deepEqual(enabledPaymentMethods(VNPAY).map((m) => m.id), ["money"]);
  });

  it("does not start a gateway that has been switched off", async () => {
    const order = await placeVnpayOrder();
    await setSetting("apiPayment", { ...VNPAY, enabledMethods: ["money"] });

    assert.equal(await startGatewayPayment("vnpay", String(order.orderCode), String(order.phone), "127.0.0.1"), null);
    assert.equal(await startGatewayPayment("money", String(order.orderCode), String(order.phone), "127.0.0.1"), null);
  });
});

describe("VNPay", () => {
  it("signs the payment URL with a Vietnam-time creation date", async () => {
    const order = await placeVnpayOrder();
    const vietnamHour = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace(/\D/g, "").slice(0, 10);

    const hourBefore = vietnamHour();
    const started = await createVNPayPaymentUrl(String(order.orderCode), String(order.phone), "127.0.0.1");
    const url = new URL(String(started?.paymentUrl));

    assert.equal(url.searchParams.get("vnp_Amount"), String(250000 * 100));
    const createHour = String(url.searchParams.get("vnp_CreateDate")).slice(0, 10);
    assert.ok([hourBefore, vietnamHour()].includes(createHour), `vnp_CreateDate hour ${createHour} is not Vietnam time`);
  });

  it("marks the order paid on a valid IPN and awards points", async () => {
    await setSetting("storefront", { moneyPerPoint: 10000 });
    const user = await createUser();
    const order = await placeVnpayOrder(String(user._id));

    const params: Record<string, unknown> = {
      vnp_Amount: String(250000 * 100),
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
      vnp_TxnRef: `${order.phone}-${order.orderCode}-${Date.now()}`
    };
    const reply = await handleVNPayIpn({ ...params, vnp_SecureHash: signVNPayParams(params, VNPAY.vnPayHashSecret) });

    assert.deepEqual(reply, { RspCode: "00", Message: "Confirm Success" });
    const saved = await Order.findOne({ code: order.orderCode });
    assert.equal(saved?.paymentStatus, "paid");
    assert.equal(saved?.pointEarned, 25);
    assert.equal((await AccountUser.findById(user._id))?.totalPoint, 25);
  });

  it("rejects a forged signature and a wrong amount", async () => {
    const order = await placeVnpayOrder();
    const params: Record<string, unknown> = {
      vnp_Amount: String(1 * 100),
      vnp_ResponseCode: "00",
      vnp_TxnRef: `${order.phone}-${order.orderCode}-1`
    };

    assert.equal((await handleVNPayIpn({ ...params, vnp_SecureHash: "0".repeat(128) })).RspCode, "97");
    assert.equal((await handleVNPayIpn({ ...params, vnp_SecureHash: signVNPayParams(params, VNPAY.vnPayHashSecret) })).RspCode, "04");
    assert.equal((await Order.findOne({ code: order.orderCode }))?.paymentStatus, "unpaid");
  });
});

describe("gateway payment", () => {
  it("is applied once, even when the callback repeats", async () => {
    const order = await placeVnpayOrder();

    assert.equal(await applyGatewayPayment(String(order.phone), String(order.orderCode), 1), "amount-mismatch");
    assert.equal(await applyGatewayPayment(String(order.phone), String(order.orderCode), 250000), "paid");
    assert.equal(await applyGatewayPayment(String(order.phone), String(order.orderCode), 250000), "already-paid");
    assert.equal(await applyGatewayPayment(String(order.phone), "NOPE", 250000), "not-found");
  });
});
