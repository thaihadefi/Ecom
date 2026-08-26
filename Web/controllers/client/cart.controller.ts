import { Request, Response } from 'express';
import * as cartService from '../../services/client/cart.service';

export const list = async (req: Request, res: Response) => {
  try {
    const { cart, userAddress } = req.body;

    const data = await cartService.getCartDetailAndShipping(
      cart || [],
      userAddress,
      res.locals.accountUser
    );

    res.json({
      code: "success",
      message: "Success!",
      ...data
    });
  } catch (error) {
    console.error("cart list error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const cart = async (_req: Request, res: Response) => {
  res.render("client/pages/cart", {
    pageTitle: "Cart"
  });
};
