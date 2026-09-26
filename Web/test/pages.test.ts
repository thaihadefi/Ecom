import "./helpers/test-env";
import { testCourier } from "./helpers/test-courier";

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createOrder } from "../services/client/order.service";
import { resetTestDb, setSetting, startTestDb, stopTestDb } from "./helpers/test-db";
import { listen, superAdminToken, TestServer } from "./helpers/http";
import { checkoutPayload, createCoupon, createProduct } from "./helpers/fixtures";

let http: TestServer;
let token: string;
let productSlug = "";
let productId = "";
let orderId = "";
let couponId = "";

before(async () => {
  await startTestDb();
  await resetTestDb();
  testCourier.fee = 30;
  await setSetting("storefront", { currency: "USD", locale: "en-US", timezone: "America/New_York" });
  const product = await createProduct({ priceNew: 19.99, priceOld: 24.5, weight: 250 });
  productSlug = String(product.slug);
  productId = String(product._id);
  const order = await createOrder(checkoutPayload([{ productId, quantity: 1 }]));
  assert.equal(order.success, true, order.message);
  const { default: Order } = await import("../models/order.model");
  orderId = String((await Order.findOne({ code: order.orderCode }))?._id);
  couponId = String((await createCoupon({ typeDiscount: "fixed", value: 5.5 }))._id);
  http = await listen();
  token = await superAdminToken();
});
after(async () => {
  await http.close();
  await stopTestDb();
});

describe("pages render", () => {
  for (const path of ["/", "/product", "/cart", "/checkout", "/about", "/faq", "/privacy-policy", "/terms-and-conditions", "/return-policy", "/contact", "/wishlist", "/compare", "/article", "/auth/login", "/auth/register"]) {
    it(`storefront ${path}`, async () => {
      const res = await fetch(http.url(path));
      assert.equal(res.status, 200, `${path} answered ${res.status}`);
    });
  }

  it("product detail shows the price in the store currency", async () => {
    const res = await fetch(http.url(`/product/detail/${productSlug}`));
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /\$19\.99/);
    assert.match(html, /lang="en"/);
  });

  const adminPages = () => [
    "/{admin}/dashboard",
    "/{admin}/dashboard/revenue-by-time",
    "/{admin}/dashboard/order-statistic",
    "/{admin}/dashboard/top-selling-products",
    "/{admin}/dashboard/customer-statistic",
    "/{admin}/dashboard/inventory-forecast",
    "/{admin}/product/list",
    "/{admin}/product/create",
    `/{admin}/product/edit/${productId}`,
    "/{admin}/order/list",
    `/{admin}/order/edit/${orderId}`,
    "/{admin}/coupon/list",
    `/{admin}/coupon/edit/${couponId}`,
    "/{admin}/setting/storefront",
    "/{admin}/setting/api-shipping",
    "/{admin}/setting/api-payment",
    "/{admin}/setting/general",
    "/{admin}/setting/pages",
    "/{admin}/setting/api-login-social",
    "/{admin}/article/list",
    "/{admin}/review/list"
  ];

  it("admin pages", async () => {
    for (const path of adminPages()) {
      const res = await fetch(http.url(path), { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(res.status, 200, `${path} answered ${res.status}`);
    }
  });

  it("order edit shows money in the store currency", async () => {
    const html = await (await fetch(http.url(`/{admin}/order/edit/${orderId}`), { headers: { Authorization: `Bearer ${token}` } })).text();
    assert.match(html, /\$49\.99/);
    assert.match(html, /Cash on Delivery/);
  });
});
