export type GatewayStartResult = { paymentUrl?: string; alreadyPaid?: boolean } | null;

/**
 * Sends the customer to an online gateway. Labels, credentials checks and the online flag live in
 * configs/payment-methods.config.ts; callbacks are routed in routes/client/order.route.ts.
 */
export interface PaymentProvider {
  /** Null when the order does not exist or can no longer be paid */
  startPayment(orderCode: string, phone: string, ipAddr: string | undefined): Promise<GatewayStartResult>;
}
