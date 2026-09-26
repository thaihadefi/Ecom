import "./helpers/test-env";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDateTime, formatPrice, priceHtml } from "../helpers/format.helper";
import { formatInZone, zonedDayKey, zonedTimeToUtc } from "../helpers/timezone.helper";
import { currencyDigits, getStorefront, toMoney } from "../configs/storefront.config";
import { buildDateRanges, parseCustomRange } from "../services/admin/dashboard.service";
import { resetTestDb, setSetting, startTestDb, stopTestDb } from "./helpers/test-db";

before(startTestDb);
after(stopTestDb);
beforeEach(resetTestDb);

const normalizeSpaces = (text: string) => text.replace(/\s/g, " ");

describe("store locale", () => {
  it("defaults to the Vietnamese store", () => {
    assert.equal(getStorefront().currency, "VND");
    assert.equal(normalizeSpaces(formatPrice(1200000)), "1.200.000 ₫");
    assert.equal(toMoney("1999.6"), 2000);
  });

  it("formats money, dates and rounding for another currency and zone", async () => {
    await setSetting("storefront", { currency: "USD", locale: "en-US", timezone: "America/New_York" });

    assert.equal(formatPrice(12.5), "$12.50");
    assert.equal(currencyDigits(), 2);
    assert.equal(toMoney("19.999"), 20);
    assert.equal(toMoney("19.994"), 19.99);
    assert.match(priceHtml(12.5), /data-base-price="12.5"/);
    // 03:30 UTC on 1 July is still 30 June in New York.
    assert.equal(formatDate(new Date("2026-07-01T03:30:00Z")), "06/30/2026");
    assert.equal(formatDateTime(new Date("2026-07-01T03:30:00Z")), "23:30 06/30/2026");
  });
});

describe("time zone helpers", () => {
  it("converts wall-clock times, including daylight saving", () => {
    assert.equal(zonedTimeToUtc("Asia/Ho_Chi_Minh", 2026, 0, 1).toISOString(), "2025-12-31T17:00:00.000Z");
    assert.equal(zonedTimeToUtc("America/New_York", 2026, 0, 15).toISOString(), "2026-01-15T05:00:00.000Z");
    assert.equal(zonedTimeToUtc("America/New_York", 2026, 6, 15).toISOString(), "2026-07-15T04:00:00.000Z");
    assert.equal(zonedDayKey(new Date("2026-01-01T16:59:59Z"), "Asia/Ho_Chi_Minh"), "2026-01-01");
    assert.equal(zonedDayKey(new Date("2026-01-01T17:00:00Z"), "Asia/Ho_Chi_Minh"), "2026-01-02");
    assert.equal(formatInZone(new Date("2026-01-01T17:05:09Z"), "Asia/Ho_Chi_Minh", "YYYYMMDDHHmmss"), "20260102000509");
  });

  it("builds report ranges in the store time zone", async () => {
    const vn = parseCustomRange("2026-03-01", "2026-03-31");
    assert.equal(vn?.fromDate.toISOString(), "2026-02-28T17:00:00.000Z");

    await setSetting("storefront", { timezone: "Europe/London" });
    const london = parseCustomRange("2026-03-01", "2026-03-31");
    assert.equal(london?.fromDate.toISOString(), "2026-03-01T00:00:00.000Z");
    assert.equal(london?.toDate.toISOString(), "2026-03-31T22:59:59.999Z");

    const { startToday, endToday, startYesterday } = buildDateRanges();
    assert.ok(endToday.getTime() - startToday.getTime() >= 23 * 3600 * 1000);
    assert.ok(startYesterday < startToday);
  });
});
