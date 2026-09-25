import { CookieOptions, NextFunction, Request, Response } from "express";

// Marks every cookie Secure exactly when the request arrived over HTTPS (req.secure honours
// X-Forwarded-Proto through "trust proxy"). A fixed `secure: true` would make browsers drop the
// session cookies whenever the site is served over plain HTTP, e.g. behind nginx before TLS is set up.
// res.clearCookie goes through res.cookie too, so cleared cookies keep matching attributes.
export const secureCookies = (req: Request, res: Response, next: NextFunction) => {
  const setCookie = res.cookie.bind(res) as (name: string, value: unknown, options: CookieOptions) => Response;
  res.cookie = ((name: string, value: unknown, options: CookieOptions = {}) =>
    setCookie(name, value, { ...options, secure: req.secure })) as Response["cookie"];
  next();
};
