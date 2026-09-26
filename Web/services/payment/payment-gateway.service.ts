import { getApiPayment } from "../../configs/setting.config";
import { enabledPaymentMethods, PaymentMethodId } from "../../configs/payment-methods.config";
import { createVNPayPaymentUrl } from "./vnpay.service";
import { createZaloPayPaymentUrl } from "./zalopay.service";

export type GatewayStartResult = { paymentUrl?: string; alreadyPaid?: boolean } | null;

type GatewayStarter = (orderCode: string, phone: string, ipAddr: string | undefined) => Promise<GatewayStartResult>;

// Online payment methods and the function that sends the customer to their gateway.
const GATEWAYS: Partial<Record<PaymentMethodId, GatewayStarter>> = {
  vnpay: (orderCode, phone, ipAddr) => createVNPayPaymentUrl(orderCode, phone, ipAddr),
  zalopay: (orderCode, phone) => createZaloPayPaymentUrl(orderCode, phone),
};

// Null when the method has no gateway, is switched off, or the order does not exist.
export const startGatewayPayment = async (
  method: string,
  orderCode: string,
  phone: string,
  ipAddr: string | undefined
): Promise<GatewayStartResult> => {
  const starter = GATEWAYS[method as PaymentMethodId];
  if (!starter) return null;

  const enabled = enabledPaymentMethods(await getApiPayment());
  if (!enabled.some((m) => m.id === method)) return null;

  return starter(orderCode, phone, ipAddr);
};
