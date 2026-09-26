import { SHIPPING_PROVIDERS } from "../../services/shipping/shipping.service";
import { ShippingProvider } from "../../services/shipping/shipping-provider";

// A local courier used only by tests, so checkout can run without calling the GoShip API.
export const testCourier = { fee: 30000, lastWeightGrams: 0 };

const provider: ShippingProvider = {
  id: "test-courier",
  label: "Test courier",
  needsDestination: false,
  isConfigured: () => true,
  async getRates() {
    return [{ id: "standard", carrierName: "Test courier", service: "Standard", expected: "", fee: testCourier.fee }];
  },
  async createShipment({ rateId, parcel }) {
    if (rateId !== "standard") throw Object.assign(new Error("Unknown rate"), { status: 400, expose: true });
    testCourier.lastWeightGrams = parcel.weightGrams;
    return { provider: "test-courier", carrierName: "Test courier", fee: testCourier.fee, cod: parcel.codAmount ? parcel.codAmount + testCourier.fee : 0 };
  }
};

if (!SHIPPING_PROVIDERS.some((p) => p.id === provider.id)) SHIPPING_PROVIDERS.push(provider);
