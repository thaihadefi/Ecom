const IS_PROD = process.env.NODE_ENV === "production";

export const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: IS_PROD,
};
