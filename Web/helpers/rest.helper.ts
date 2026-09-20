import { NextFunction, Request, Response } from "express";

// DELETE /resource/:id moves a record to the trash; the route that follows this guard, reached with ?permanent=true,
// deletes it for good. Any other request skips it and falls through to the next matching route.
export const permanentOnly = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.query.permanent === "true") {
    next();
    return;
  }
  next("route");
};
