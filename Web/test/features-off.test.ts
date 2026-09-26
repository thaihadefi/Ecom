import "./helpers/test-env";
process.env.FEATURE_CHAT = "false";
process.env.FEATURE_AI = "false";
process.env.FEATURE_ML_FRAUD = "false";
process.env.FEATURE_RECOMMENDATIONS = "false";
process.env.FEATURE_STOCK_FORECAST = "false";
process.env.FEATURE_BLOG = "false";
process.env.FEATURE_WISHLIST = "false";
process.env.FEATURE_COMPARE = "false";
process.env.FEATURE_REVIEWS = "false";
process.env.FEATURE_COUPONS = "false";
process.env.FEATURE_LOYALTY = "false";
process.env.FEATURE_TRANSLATE = "false";

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { resetTestDb, setSetting, startTestDb, stopTestDb } from "./helpers/test-db";
import { testCourier } from "./helpers/test-courier";
import { checkoutPayload, createCoupon, createProduct, createUser } from "./helpers/fixtures";
import { createOrder } from "../services/client/order.service";
import { pointsEarnedFor } from "../helpers/point.helper";
import { jsonHeaders, listen, superAdminToken, TestServer } from "./helpers/http";

let http: TestServer;
let token: string;

before(async () => {
  await startTestDb();
  await resetTestDb();
  http = await listen();
  token = await superAdminToken();
});
after(async () => {
  await http.close();
  await stopTestDb();
});

describe("switched-off features", () => {
  for (const path of [
    "/api/chat-rooms/current/messages",
    "/{admin}/api/chat-rooms/000000000000000000000000/messages",
    "/{admin}/api/flagged-orders/retraining",
    "/{admin}/api/recommendation-jobs/latest",
    "/api/wishlist",
    "/api/compare",
    "/api/coupon-checks",
    "/api/articles",
    "/api/reviews/000000000000000000000000/reports",
    "/{admin}/api/coupons",
    "/{admin}/api/articles",
    "/{admin}/api/reviews"
  ]) {
    it(`answers 404 on ${path}`, async () => {
      const res = await fetch(http.url(path), { headers: jsonHeaders(token) });
      assert.equal(res.status, 404);
      assert.equal((await res.json()).code, "error");
    });
  }

  for (const path of [
    "/{admin}/dashboard/inventory-forecast",
    "/{admin}/order/flagged",
    "/{admin}/chat/list/my-chat",
    "/{admin}/coupon/list",
    "/{admin}/article/list",
    "/{admin}/review/list",
    "/wishlist",
    "/compare",
    "/article"
  ]) {
    it(`renders the 404 page on ${path}`, async () => {
      const res = await fetch(http.url(path), { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(res.status, 404);
    });
  }

  it("leaves the modules' UI out of the storefront", async () => {
    const product = await createProduct();
    const cart = await (await fetch(http.url("/cart"))).text();
    assert.doesNotMatch(cart, /socket\.io\.js/);
    assert.doesNotMatch(cart, /assets\/js\/chat\.js/);
    assert.doesNotMatch(cart, /href="\/wishlist"/);
    assert.doesNotMatch(cart, /href="\/compare"/);
    assert.doesNotMatch(cart, /applyCouponForm/);
    assert.doesNotMatch(cart, /point-row/);
    assert.doesNotMatch(cart, /gtranslate_wrapper/);

    const detail = await (await fetch(http.url(`/product/detail/${product.slug}`))).text();
    assert.doesNotMatch(detail, /button-add-wishlist|button-add-compare|description-tab4/);
  });

  it("refuses coupons and awards no points at checkout", async () => {
    await setSetting("apiShipping", {});
    testCourier.fee = 0;
    const product = await createProduct({ stock: 5 });
    const coupon = await createCoupon();
    const user = await createUser({ totalPoint: 50 });
    const items = [{ productId: String(product._id), quantity: 1 }];

    const withCoupon = await createOrder(checkoutPayload(items, { coupon: coupon.code }), { id: String(user._id) });
    assert.equal(withCoupon.success, false);
    assert.equal(withCoupon.status, 400);

    const withPoints = await createOrder(checkoutPayload(items, { usePoint: true }), { id: String(user._id), totalPoint: 50, usedPoint: 0 });
    assert.equal(withPoints.success, true, withPoints.message);
    assert.equal(withPoints.total, 100000);
    assert.equal(pointsEarnedFor({ subTotal: 1000000 }), 0);
  });
});
