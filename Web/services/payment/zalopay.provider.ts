import { PaymentProvider } from "./payment-provider.interface";
import { createZaloPayPaymentUrl } from "./zalopay.service";

export const zalopayProvider: PaymentProvider = {
  startPayment: (orderCode, phone) => createZaloPayPaymentUrl(orderCode, phone),
};
