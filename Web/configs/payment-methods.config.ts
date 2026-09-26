import { ISettingApiPayment } from "../interfaces/models/setting.interface";
import { getStorefront } from "./storefront.config";

// Every payment method the store knows. The order schema, checkout validation, checkout options,
// labels and the unpaid-order job all read this list.
//
// To add a gateway: add an entry here, add its gateway module to services/payment/payment-gateway.service.ts,
// and register its callback route in routes/client/order.route.ts.

export interface PaymentMethodDefinition {
  id: string;
  /** Short name shown on orders, emails and the admin panel */
  label: string;
  /** Text next to the radio button at checkout */
  checkoutLabel: string;
  /** Font Awesome classes for the checkout icon */
  icon: string;
  /** The customer pays on a gateway page; unpaid orders expire (see jobs/order.job.ts) */
  online: boolean;
  /** The courier collects the order total on delivery */
  collectOnDelivery: boolean;
  /** Store currencies the gateway can charge in; omitted means any */
  currencies?: readonly string[];
  /** Whether the store has entered the credentials this method needs */
  isConfigured: (api: ISettingApiPayment) => boolean;
}

const filled = (...values: Array<string | undefined>) => values.every((v) => Boolean(v && String(v).trim()));

export const PAYMENT_METHODS = [
  {
    id: "money",
    label: "Cash on Delivery",
    checkoutLabel: "Cash on Delivery",
    icon: "fas fa-money-bill-wave text-success",
    online: false,
    collectOnDelivery: true,
    isConfigured: () => true,
  },
  {
    id: "vnpay",
    label: "VNPay",
    checkoutLabel: "Pay via VNPay",
    icon: "fas fa-credit-card text-primary",
    online: true,
    collectOnDelivery: false,
    currencies: ["VND"],
    isConfigured: (api) => filled(api.vnPayTmnCode, api.vnPayHashSecret, api.vnPayURL),
  },
  {
    id: "zalopay",
    label: "ZaloPay",
    checkoutLabel: "Pay via ZaloPay",
    icon: "fas fa-wallet text-info",
    online: true,
    collectOnDelivery: false,
    currencies: ["VND"],
    isConfigured: (api) => filled(api.zaloPayAppId, api.zaloPayKey1, api.zaloPayKey2),
  },
] as const satisfies readonly PaymentMethodDefinition[];

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

export const PAYMENT_METHOD_IDS = PAYMENT_METHODS.map((m) => m.id) as PaymentMethodId[];

export const ONLINE_PAYMENT_METHOD_IDS = PAYMENT_METHODS.filter((m) => m.online).map((m) => m.id) as PaymentMethodId[];

export const DEFAULT_PAYMENT_METHOD: PaymentMethodId = "money";

export const getPaymentMethod = (id: string | undefined): PaymentMethodDefinition | undefined =>
  PAYMENT_METHODS.find((m) => m.id === id);

export const paymentMethodLabel = (id: string | undefined): string => getPaymentMethod(id)?.label ?? (id || "");

export const isOnlinePayment = (id: string | undefined): boolean => Boolean(getPaymentMethod(id)?.online);

// Whether the gateway can charge in the store currency (Settings > Storefront).
export const supportsStoreCurrency = (method: PaymentMethodDefinition): boolean =>
  !method.currencies || method.currencies.includes(getStorefront().currency);

// Methods offered at checkout: configured, able to charge the store currency, and switched on in
// Settings > Payment when the store has chosen a subset there.
export const enabledPaymentMethods = (api: ISettingApiPayment): PaymentMethodDefinition[] => {
  const chosen = Array.isArray(api.enabledMethods) ? api.enabledMethods : null;
  return PAYMENT_METHODS.filter((m: PaymentMethodDefinition) =>
    m.isConfigured(api) && supportsStoreCurrency(m) && (!chosen || chosen.includes(m.id))
  );
};
