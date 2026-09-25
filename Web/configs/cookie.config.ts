// `secure` is set per request by middlewares/secure-cookie.middleware.ts (Secure only over HTTPS).
export const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
};
