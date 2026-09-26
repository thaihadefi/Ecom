const REQUIRED_ENV_KEYS = ["DATABASE", "JWT_SECRET", "FILE_MANAGER_SECRET"] as const;

// Storefront prefixes the admin panel must not shadow.
const RESERVED_ADMIN_PATHS = [
  "about", "api", "api-docs", "article", "auth", "cart", "checkout", "client", "compare", "contact", "coupon",
  "dashboard", "faq", "images", "media", "order", "privacy-policy", "product", "return-policy", "search",
  "socket.io", "terms-and-conditions", "wishlist"
];

export const validateEnv = (): void => {
  const missing = REQUIRED_ENV_KEYS.filter((key) => {
    const value = process.env[key];
    return typeof value !== "string" || value.trim() === "";
  });

  if (missing.length > 0) {
    console.error(`[Env] Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  const adminPath = process.env.ADMIN_PATH?.trim().replace(/^\/+|\/+$/g, "");
  if (adminPath && !/^[a-z0-9-]+$/i.test(adminPath)) {
    console.error("[Env] Invalid ADMIN_PATH. Use letters, digits and dashes only, e.g. ADMIN_PATH=backoffice.");
    process.exit(1);
  }
  if (adminPath && RESERVED_ADMIN_PATHS.includes(adminPath.toLowerCase())) {
    console.error(`[Env] ADMIN_PATH "${adminPath}" collides with a storefront route.`);
    process.exit(1);
  }

  if (process.env.PORT && Number.isNaN(Number(process.env.PORT))) {
    console.error("[Env] Invalid PORT. PORT must be a number.");
    process.exit(1);
  }
};
