import { getApiPayment } from "../../configs/setting.config";
import { enabledPaymentMethods, PaymentMethodId } from "../../configs/payment-methods.config";
import { PaymentProvider, GatewayStartResult } from "./payment-provider.interface";
import { vnpayProvider } from "./vnpay.provider";
import { zalopayProvider } from "./zalopay.provider";

export type { GatewayStartResult, PaymentProvider };

// Online payment methods and the provider that sends the customer to their gateway.
// To add a gateway: add it to configs/payment-methods.config.ts, implement PaymentProvider
// in its own file (see vnpay.provider.ts), and register it here.
const PROVIDERS: Partial<Record<PaymentMethodId, PaymentProvider>> = {
  vnpay: vnpayProvider,
  zalopay: zalopayProvider,
};

// Null when the method has no gateway, is switched off, or the order does not exist.
export const startGatewayPayment = async (
  method: string,
  orderCode: string,
  phone: string,
  ipAddr: string | undefined
): Promise<GatewayStartResult> => {
  const provider = PROVIDERS[method as PaymentMethodId];
  if (!provider) return null;

  const enabled = enabledPaymentMethods(await getApiPayment());
  if (!enabled.some((m) => m.id === method)) return null;

  return provider.startPayment(orderCode, phone, ipAddr);
};
