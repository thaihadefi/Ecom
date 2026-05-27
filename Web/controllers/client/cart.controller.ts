import { Request, Response } from 'express';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import axios from 'axios';
import { getInfoAddress } from '../../helpers/location.helper';
import { pointConfig } from '../../configs/variable.config';
import { getApiShipping } from '../../configs/setting.config';

export const list = async (req: Request, res: Response) => {
  try {
    const { cart, userAddress } = req.body;

    // Get product details
    const cartDetail: any[] = [];

    const productIds = cart.map((i: any) => i.productId);
    const products = await Product.find({
      _id: { $in: productIds },
      deleted: false,
      status: "active"
    }).select("_id slug name priceNew priceOld stock images attributes variants");
    const productMap = new Map((products as any[]).map((p: any) => [String(p._id), p]));

    const allAttrIds = (products as any[]).flatMap((p: any) => p.attributes || []);
    const attrList = await AttributeProduct.find({ _id: { $in: allAttrIds } }).select("_id name");
    const attrMap = new Map((attrList as any[]).map((a: any) => [String(a._id), a]));

    for (const item of cart) {
      const productDetail = productMap.get(String(item.productId));
      if (productDetail) {
        const attributeList = (productDetail.attributes || []).map((id: any) => attrMap.get(String(id))).filter(Boolean);
        
        let quantity = item.quantity;
        if (productDetail.stock !== undefined && quantity > productDetail.stock) {
          quantity = Math.max(0, productDetail.stock);
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
    // End Get product details

    // Calculate shipping fee
    let shippingOptions = null;
    if(userAddress) {
      // Coordinates of the sender
      const shopLocation = {
        lat: parseFloat(process.env.SHOP_LAT || "10.8037448"),
        lng: parseFloat(process.env.SHOP_LNG || "106.6617749")
      };

      const [shopInfoAddress, userInfoAddress] = await Promise.all([
        getInfoAddress(shopLocation.lat, shopLocation.lng),
        getInfoAddress(userAddress.latitude, userAddress.longitude)
      ]);

      // Calculate total order weight
      const totalWeight = cartDetail.reduce((total, item) => total + item.quantity * 500, 0); // Each item weighs 500g

      const dataGoShip = {
        shipment: {
          address_from: {
            city: shopInfoAddress.city, // Get from API: /cities
            district: shopInfoAddress.district, // Get from API: /districts
            ward: shopInfoAddress.ward // Get from API: /wards
          },
          address_to: {
            city: userInfoAddress.city,
            district: userInfoAddress.district,
            ward: userInfoAddress.ward
          },
          parcel: {
            cod: "0", // Cash on delivery
            amout: "0", // Declared value
            weight: totalWeight,
            width: "10",
            height: "10",
            length: "10"
          }
        }
      };

      const apiShipping = await getApiShipping();

      const goshipRes = await axios.post(`${process.env.GOSHIP_API_URL || "https://sandbox.goship.io/api/v2"}/rates`, dataGoShip, {
        headers: {
          Authorization: `Bearer ${apiShipping.tokenGoShip}`,
          "Content-Type": "application/json"
        }
      });

      shippingOptions = goshipRes.data.data;
    }
    // End Calculate shipping fee

    // Return user reward points
    const point = {
      canUsePoint: 0,
      POINT_TO_MONEY: pointConfig.POINT_TO_MONEY
    };
    if(res.locals.accountUser) {
      point.canUsePoint = res.locals.accountUser.totalPoint - res.locals.accountUser.usedPoint;
    }
    // End Return user reward points

    res.json({
      code: "success",
      message: "Success!",
      cart: cartDetail,
      shippingOptions: shippingOptions,
      point: point
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const cart = async (_req: Request, res: Response) => {
  res.render("client/pages/cart", {
    pageTitle: "Cart"
  });
}