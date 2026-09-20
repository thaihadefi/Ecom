import { Request, Response } from 'express';
import * as cartService from '../../services/client/cart.service';
import { sendCaughtError } from "../../helpers/http-response.helper";

export const list = async (req: Request, res: Response) => {
  try {
    const { cart, userAddress } = req.body;

    const cartItems = Array.isArray(cart) ? cart : [];
    const validItems = cartItems.every((item) =>
      item && typeof item.productId === "string" && Number.isFinite(Number(item.quantity)) && Number(item.quantity) >= 0
    );
    const latitude = Number(userAddress?.latitude);
    const longitude = Number(userAddress?.longitude);
    const validAddress = userAddress === undefined || userAddress === null ||
      (Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180);

    if (cartItems.length > 100 || !validItems || !validAddress) {
      res.status(400).json({ code: "error", message: "Invalid data!" });
      return;
    }

    const data = await cartService.getCartDetailAndShipping(
      cartItems,
      userAddress ? { latitude, longitude } : undefined,
      res.locals.accountUser
    );

    res.json({
      code: "success",
      message: "Success!",
      ...data
    });
  } catch (error) {
    console.error("cart list error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const cart = async (_req: Request, res: Response) => {
  res.render("client/pages/cart", {
    pageTitle: "Cart"
  });
};
