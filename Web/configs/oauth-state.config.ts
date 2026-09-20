import crypto from "crypto";
import { Request } from "express";
import type { StateStoreStoreCallback, StateStoreVerifyCallback } from "passport-oauth2";

const COOKIE_NAME = "oauth_state";

type StoreCallback = StateStoreStoreCallback;
type VerifyCallback = StateStoreVerifyCallback;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/auth",
};

export class CookieStateStore {
  store(req: Request, metaOrCallback: unknown, maybeCallback?: StoreCallback): void {
    const callback = (typeof metaOrCallback === "function" ? metaOrCallback : maybeCallback) as StoreCallback;
    const state = crypto.randomBytes(24).toString("hex");
    req.res?.cookie(COOKIE_NAME, state, { ...cookieOptions, maxAge: 10 * 60 * 1000 });
    callback(null, state);
  }

  verify(req: Request, state: string, metaOrCallback: unknown, maybeCallback?: VerifyCallback): void {
    const callback = (typeof metaOrCallback === "function" ? metaOrCallback : maybeCallback) as VerifyCallback;
    const expected = String(req.cookies?.[COOKIE_NAME] ?? "");
    req.res?.clearCookie(COOKIE_NAME, cookieOptions);

    const given = Buffer.from(String(state));
    const wanted = Buffer.from(expected);
    if (!expected || given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) {
      callback(null, false, { message: "Invalid OAuth state" });
      return;
    }
    callback(null, true, undefined);
  }
}
