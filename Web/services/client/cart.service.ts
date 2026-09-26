import Product from '../../models/product.model';
import { getActiveAttributes } from '../admin/attribute-product.service';
import { getStorefront } from '../../configs/storefront.config';
import { FEATURES } from '../../configs/features.config';
import { getShippingContext, quoteShippingRates, unitWeight } from '../shipping/shipping.service';
import { ShippingRate } from '../shipping/shipping-provider';
import { IProduct } from '../../interfaces/models/product.interface';

export interface CartItemInput {
  productId: string;
  quantity: number;
  [key: string]: unknown;
}

export interface UserAddressInput {
  latitude: number;
  longitude: number;
}

export const getCartDetailAndShipping = async (
  cart: CartItemInput[],
  userAddress?: UserAddressInput,
  accountUser?: { totalPoint?: number; usedPoint?: number }
) => {
  const cartDetail: unknown[] = [];
  // Items ticked for checkout, for the shipping quote.
  const shippingLines: Array<{ quantity: number; unitPrice: number; weight?: number | null }> = [];

  const productIds = cart.map((i) => i.productId);
  const products: IProduct[] = await Product.find({
    _id: { $in: productIds },
    deleted: false,
    status: "active"
  }).select("_id slug name priceNew priceOld stock weight images attributes variants");
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const attrList = await getActiveAttributes();
  const attrMap = new Map(attrList.map((a) => [String(a._id), a]));

  for (const item of cart) {
    const productDetail = productMap.get(String(item.productId));
    if (productDetail) {
      const attributeList = (productDetail.attributes || []).map((id) => attrMap.get(String(id))).filter(Boolean);

      let availableStock = productDetail.stock;
      let unitPrice = productDetail.priceNew || 0;
      const itemVariant = item.variant as Array<{ attrId?: string; value?: string }> | undefined;
      if (itemVariant && Array.isArray(itemVariant) && itemVariant.length > 0 && productDetail.variants) {
        const variantMatched = (productDetail.variants as Array<{ attributeValue?: Array<{ attrId?: string; value?: string }>; stock?: number }>).find((v) =>
          v.attributeValue &&
          v.attributeValue.length === itemVariant.length &&
          v.attributeValue.every((attr) => {
            const selected = itemVariant.find((sel) => String(sel.attrId) === String(attr.attrId));
            return selected && String(selected.value) === String(attr.value);
          })
        );
        if (variantMatched && typeof variantMatched.stock === "number") {
          availableStock = variantMatched.stock;
        }
        const variantPrice = (variantMatched as { priceNew?: number } | undefined)?.priceNew;
        if (typeof variantPrice === "number") unitPrice = variantPrice;
      }

      let quantity = item.quantity;
      if (availableStock !== undefined && quantity > availableStock) {
        quantity = Math.max(0, availableStock);
      }

      if (item.checked !== false) {
        shippingLines.push({ quantity: quantity || 1, unitPrice, weight: productDetail.weight });
      }

      cartDetail.push({
        ...item,
        quantity,
        detail: {
          images: productDetail.images,
          slug: productDetail.slug,
          name: productDetail.name,
          priceNew: productDetail.priceNew,
          priceOld: productDetail.priceOld,
          stock: productDetail.stock,
          attributeList,
          variants: productDetail.variants
        }
      });
    }
  }

  // Providers that need the customer's location quote once it is picked; the others quote right away.
  const ctx = await getShippingContext();
  const shippingOptions: ShippingRate[] = await quoteShippingRates({
    destination: userAddress ? { lat: userAddress.latitude, lng: userAddress.longitude } : undefined,
    parcel: {
      weightGrams: shippingLines.reduce((total, line) => total + line.quantity * unitWeight(line.weight, ctx), 0),
      orderValue: shippingLines.reduce((total, line) => total + line.quantity * line.unitPrice, 0),
      declaredValue: 0,
      codAmount: 0
    }
  }, ctx);

  const point = {
    canUsePoint: 0,
    POINT_TO_MONEY: getStorefront().pointValue
  };
  if (accountUser && FEATURES.LOYALTY_POINTS) {
    point.canUsePoint = Math.max(0, (accountUser.totalPoint || 0) - (accountUser.usedPoint || 0));
  }

  return {
    cart: cartDetail,
    shippingOptions,
    point
  };
};
