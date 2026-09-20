const IS_PROD = process.env.NODE_ENV === "production";
export const MIN_SECRET_LENGTH = 32;

// Origins allowed to call FileManager from a browser (comma separated). Unset means "*" in development
// and no CORS headers in production, because the Web app calls FileManager server to server.
export const CORS_ORIGINS = (process.env.FILE_MANAGER_CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

export const assertSecretStrength = (): void => {
  const secret = process.env.FILE_MANAGER_SECRET || "";
  if (IS_PROD && secret.length < MIN_SECRET_LENGTH) {
    console.error(`[FileManager] FILE_MANAGER_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production.`);
    process.exit(1);
  }
};

export const trustProxy = (): number | string | boolean => {
  const value = process.env.TRUST_PROXY;
  if (value === undefined) return IS_PROD ? 1 : false;
  return Number.isNaN(Number(value)) ? value : Number(value);
};
