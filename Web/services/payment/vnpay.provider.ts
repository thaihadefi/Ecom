import { PaymentProvider } from "./payment-provider.interface";
import { createVNPayPaymentUrl } from "./vnpay.service";

export const vnpayProvider: PaymentProvider = {
  startPayment: (orderCode, phone, ipAddr) => createVNPayPaymentUrl(orderCode, phone, ipAddr),
};
