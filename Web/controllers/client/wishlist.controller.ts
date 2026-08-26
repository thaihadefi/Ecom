import { Request, Response } from 'express';
import * as wishlistService from '../../services/client/wishlist.service';

export const wishlist = (_req: Request, res: Response) => {
  res.render("client/pages/wishlist", {
    pageTitle: "Wishlist"
  });
};

export const list = async (req: Request, res: Response) => {
  try {
    const wishlist = req.body || [];
    const wishlistDetail = await wishlistService.getWishlistDetailList(wishlist);

    res.json({
      code: "success",
      message: "Success!",
      wishlist: wishlistDetail
    });
  } catch (error) {
    console.error("wishlist list error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};
