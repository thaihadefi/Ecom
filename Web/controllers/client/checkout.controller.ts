import { Request, Response } from 'express';

export const checkout = (_req: Request, res: Response) => {
  res.render("client/pages/checkout", {
    pageTitle: "Checkout"
  });
}
