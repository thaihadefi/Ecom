import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

const currentYear = new Date().getFullYear();

const dateField = Joi.string()
  .required()
  .custom((value: string, helpers: Joi.CustomHelpers) => {
    const m = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value);
    if (!m) return helpers.error('any.invalid');

    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);

    if (y > currentYear) return helpers.error('any.invalid');

    const daysInMonth = new Date(y, mo, 0).getDate();
    if (d > daysInMonth) return helpers.error('any.invalid');

    return value;
  })
  .messages({
    'string.empty': 'Date is required',
    'any.required': 'Date is required',
    'any.invalid': 'Invalid date — day exceeds days in month, month must be 1–12, or year exceeds current year',
  });

export const validateDateRangeFilter = (req: Request, res: Response, next: NextFunction) => {
  const { from, to } = req.query;

  if (!from && !to) return next();

  const schema = Joi.object({ from: dateField, to: dateField });
  const { error, value } = schema.validate({ from, to });

  if (error) {
    res.redirect(req.path);
    return;
  }

  if (new Date(value.from as string) > new Date(value.to as string)) {
    res.redirect(req.path);
    return;
  }

  next();
};
