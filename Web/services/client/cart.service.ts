import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import axios from 'axios';
import { getInfoAddress } from '../../helpers/location.helper';
import { pointConfig } from '../../configs/variable.config';
import { getApiShipping, getGeneral } from '../../configs/setting.config';
import { IProduct } from '../../interfaces/models/product.interface';
import { IAttributeProduct } from '../../interfaces/models/attribute-product.interface';

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

  const productIds = cart.map((i) => i.productId);
  const products: IProduct[] = await Product.find({
    _id: { $in: productIds },
    deleted: false,
    status: "active"
  }).select("_id slug name priceNew priceOld stock images attributes variants");
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const allAttrIds = products.flatMap((p) => (p.attributes || []).map(String));
  const attrList: IAttributeProduct[] = await AttributeProduct.find({ _id: { $in: allAttrIds } }).select("_id name");
  const attrMap = new Map(attrList.map((a) => [String(a._id), a]));

  for (const item of cart) {
    const productDetail = productMap.get(String(item.productId));
    if (productDetail) {
      const attributeList = (productDetail.attributes || []).map((id) => attrMap.get(String(id))).filter(Boolean);

      let availableStock = productDetail.stock;
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
      }

      let quantity = item.quantity;
      if (availableStock !== undefined && quantity > availableStock) {
        quantity = Math.max(0, availableStock);
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

  let shippingOptions = null;
  if (userAddress) {
    const general = await getGeneral();
    const shopLocation = {
      lat: parseFloat(String(general.shopLat || "10.8700089")),
      lng: parseFloat(String(general.shopLng || "106.8030541"))
    };

    const [shopInfoAddress, userInfoAddress] = await Promise.all([
      getInfoAddress(shopLocation.lat, shopLocation.lng),
      getInfoAddress(userAddress.latitude, userAddress.longitude)
    ]);

    const totalWeight = cartDetail.reduce((total: number, item) => total + ((item as CartItemInput).quantity || 1) * 500, 0);

    const dataGoShip = {
      shipment: {
        address_from: {
          city: shopInfoAddress.city,
          district: shopInfoAddress.district,
          ward: shopInfoAddress.ward
        },
        address_to: {
          city: userInfoAddress.city,
          district: userInfoAddress.district,
          ward: userInfoAddress.ward
        },
        parcel: {
          cod: "0",
          amount: "0",
          weight: totalWeight,
          width: "10",
          height: "10",
          length: "10"
        }
      }
    };

    const apiShipping = await getApiShipping();
    const goshipBase = String(apiShipping.goshipApiUrl || "https://sandbox.goship.io/api/v2");
    const goshipRes = await axios.post(`${goshipBase}/rates`, dataGoShip, {
      headers: {
        Authorization: `Bearer ${apiShipping.tokenGoShip}`,
        "Content-Type": "application/json"
      }
    });

    shippingOptions = goshipRes.data.data;
  }

  const point = {
    canUsePoint: 0,
    POINT_TO_MONEY: pointConfig.POINT_TO_MONEY
  };
  if (accountUser) {
    point.canUsePoint = Math.max(0, (accountUser.totalPoint || 0) - (accountUser.usedPoint || 0));
  }

  return {
    cart: cartDetail,
    shippingOptions,
    point
  };
};
