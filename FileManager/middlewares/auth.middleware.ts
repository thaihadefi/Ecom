import { NextFunction, Request, Response } from "express";

export const verifySecret = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!process.env.FILE_MANAGER_SECRET) {
      res.status(500).json({
        code: "error",
        message: "Server misconfiguration: Secret key is not set!"
      });
      return;
    }

    if(!authHeader || authHeader !== `Bearer ${process.env.FILE_MANAGER_SECRET}`) {
      res.status(401).json({
        code: "error",
        message: "Access denied!"
      });
      return;
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({
      code: "error",
      message: "Internal server error during authentication!"
    });
  }
}
