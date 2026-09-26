import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { pathAdmin } from "../../configs/variable.config";
import AccountAdmin from "../../models/account-admin.model";

export interface TestServer {
  url: (path: string) => string;
  close: () => Promise<void>;
}

// Serves the real Express app on a random local port.
export const listen = async (): Promise<TestServer> => {
  const { server } = await import("../../app");
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: (path) => `http://127.0.0.1:${port}${path.replace("{admin}", pathAdmin)}`,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  };
};

// Bearer token of a freshly created super admin.
export const superAdminToken = async (): Promise<string> => {
  const admin = await AccountAdmin.create({
    fullName: "Test Admin",
    email: `admin-${Date.now()}@example.test`,
    password: "unused",
    status: "active",
    isSuperAdmin: true,
    deleted: false
  });
  return jwt.sign({ id: String(admin._id), email: admin.email }, String(process.env.JWT_SECRET), { expiresIn: "10m" });
};

export const jsonHeaders = (token?: string): Record<string, string> => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {})
});
