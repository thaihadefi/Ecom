import { NextFunction, Request, Response } from "express";
import { FEATURES, FeatureName } from "../configs/features.config";
import { pathAdmin } from "../configs/variable.config";

// A switched-off feature answers exactly like a route that does not exist.
export const requireFeature = (feature: FeatureName) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (FEATURES[feature]) {
      next();
      return;
    }

    if (req.originalUrl.includes("/api/")) {
      res.status(404).json({ code: "error", message: "Not found!" });
      return;
    }

    const isAdmin = req.originalUrl === `/${pathAdmin}` || req.originalUrl.startsWith(`/${pathAdmin}/`);
    res.status(404).render(isAdmin ? "admin/pages/404" : "client/pages/404", {
      pageTitle: isAdmin ? "404 | Admin" : "404 | Page not found"
    });
  };
