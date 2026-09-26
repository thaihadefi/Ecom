import "./helpers/test-env";
import { testCourier } from "./helpers/test-courier";

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { resetTestDb, setSetting, startTestDb, stopTestDb } from "./helpers/test-db";
import { jsonHeaders, listen, superAdminToken, TestServer } from "./helpers/http";
import { createProduct } from "./helpers/fixtures";

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

describe("features on by default", () => {
  it("serves the chat API (asks the guest to log in)", async () => {
    const res = await fetch(http.url("/api/chat-rooms/current/messages"), { headers: jsonHeaders() });
    assert.equal(res.status, 401);
  });

  it("serves the recommendation job status to staff", async () => {
    const res = await fetch(http.url("/{admin}/api/recommendation-jobs/latest"), { headers: jsonHeaders(token) });
    assert.equal(res.status, 200);
  });

  it("renders the inventory forecast page", async () => {
    const res = await fetch(http.url("/{admin}/dashboard/inventory-forecast"), { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(res.status, 200);
  });

  it("includes the chat widget on the storefront", async () => {
    const html = await (await fetch(http.url("/cart"))).text();
    assert.match(html, /assets\/js\/chat\.js/);
  });
});

describe("storefront settings over HTTP", () => {
  it("rejects an invalid theme color and accepts a valid storefront", async () => {
    const bad = await fetch(http.url("/{admin}/api/settings/storefront"), {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ primaryColor: "red; background:url(x)" })
    });
    assert.equal(bad.status, 400);

    const ok = await fetch(http.url("/{admin}/api/settings/storefront"), {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ primaryColor: "#112233", currency: "usd", locale: "en-US", timezone: "America/New_York", language: "en" })
    });
    assert.equal(ok.status, 200, await ok.text());

    const html = await (await fetch(http.url("/cart"))).text();
    assert.match(html, /--themeColorOne: #112233/);
    assert.match(html, /"currency":"USD"/);
  });

  it("shows the display currencies and the charge note", async () => {
    await setSetting("storefront", { currency: "VND", displayCurrencies: ["USD"] });
    const html = await (await fetch(http.url("/cart"))).text();
    assert.match(html, /<option value="VND">VND<\/option><option value="USD">USD<\/option>/);
    assert.match(html, /You will be charged in VND/);

    await setSetting("storefront", { currency: "VND", displayCurrencies: [] });
    assert.doesNotMatch(await (await fetch(http.url("/cart"))).text(), /data-currency-switcher/);
  });

  it("quotes shipping for the cart", async () => {
    testCourier.fee = 25000;
    const product = await createProduct({ priceNew: 150000 });

    const res = await fetch(http.url("/api/cart/quote"), {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ cart: [{ productId: String(product._id), quantity: 1, checked: true }] })
    });
    assert.equal(res.status, 200);
    const options = (await res.json()).shippingOptions;
    assert.deepEqual(options.map((o: { id: string; fee: number }) => [o.id, o.fee]), [["test-courier:standard", 25000]]);
  });

});

describe("store content from settings", () => {
  it("links only the social profiles the store filled in", async () => {
    await setSetting("general", { storeDescription: "Handmade ceramics", instagramUrl: "https://instagram.com/shop" });
    const html = await (await fetch(http.url("/cart"))).text();
    assert.match(html, /Handmade ceramics/);
    assert.match(html, /href="https:\/\/instagram\.com\/shop"/);
    assert.doesNotMatch(html, /facebook\.com\/UIT|uitchannel/);
  });

  it("offers social login only once its keys are saved", async () => {
    await setSetting("apiLoginSocial", {});
    assert.doesNotMatch(await (await fetch(http.url("/auth/login"))).text(), /href="\/auth\/google"/);
    const blocked = await fetch(http.url("/auth/google"), { redirect: "manual" });
    assert.equal(blocked.headers.get("location"), "/auth/login");

    await setSetting("apiLoginSocial", { googleClientId: "id", googleClientSecret: "secret" });
    const login = await (await fetch(http.url("/auth/login"))).text();
    assert.match(login, /href="\/auth\/google"/);
    assert.doesNotMatch(login, /href="\/auth\/facebook"/);
  });

  it("shows page text saved in admin, sanitized, and the default otherwise", async () => {
    assert.match(await (await fetch(http.url("/return-policy"))).text(), /Return Policy/);

    const save = await fetch(http.url("/{admin}/api/settings/pages"), {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ returnPolicy: "<h2>30-day returns</h2><script>alert(1)</script>" })
    });
    assert.equal(save.status, 200);

    const html = await (await fetch(http.url("/return-policy"))).text();
    assert.match(html, /<h2>30-day returns<\/h2>/);
    assert.doesNotMatch(html, /alert\(1\)/);
  });
});

describe("payment routes", () => {
  it("keeps gateway callbacks ahead of the generic start route", async () => {
    const ipn = await fetch(http.url("/order/payment-vnpay-ipn"));
    assert.equal(ipn.status, 200);
    assert.equal((await ipn.json()).RspCode, "97");

    const start = await fetch(http.url("/order/payment-vnpay?orderCode=NOPE&phone=0"), { redirect: "manual" });
    assert.equal(start.status, 302);
    assert.equal(start.headers.get("location"), "/");
  });
});

