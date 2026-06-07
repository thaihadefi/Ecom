import { Request, Response } from 'express';
import Setting from '../../models/setting.model';
import { RequestAccount } from '../../interfaces/request.interface';
import { logAdminAction } from '../../helpers/log.helper';

export const apiShipping = async (req: Request, res: Response) => {
  const key = "apiShipping";

  const record = await Setting.findOne({
    key: key
  });
  
  res.render("admin/pages/setting-api-shipping", {
    pageTitle: "Shipping API",
    record: record
  });
}

export const apiShippingPatch = async (req: RequestAccount, res: Response) => {
  const { tokenGoShip } = req.body;

  const key = "apiShipping";

  const data = {
    tokenGoShip: tokenGoShip
  };

  await Setting.findOneAndUpdate(
    {
      key: key
    },
    {
      key: key,
      data: data,
      updatedBy: req.adminId
    },
    {
      upsert: true, // Create a new record if not found
    }
  );
  
  res.json({
    code: "success",
    message: "Updated successfully!"
  })
}

export const apiPayment = async (req: Request, res: Response) => { 
  const key = "apiPayment";

  const record = await Setting.findOne({
    key: key
  });
  
  res.render("admin/pages/setting-api-payment", {
    pageTitle: "Payment Gateway API",
    record: record
  });
}

export const apiPaymentPatch = async (req: RequestAccount, res: Response) => {
  const key = "apiPayment";

  await Setting.findOneAndUpdate(
    {
      key: key
    },
    {
      key: key,
      data: req.body,
      updatedBy: req.adminId
    },
    {
      upsert: true, // Create a new record if not found
    }
  );
  
  res.json({
    code: "success",
    message: "Updated successfully!"
  })
}

export const apiLoginSocial = async (req: Request, res: Response) => { 
  const key = "apiLoginSocial";

  const record = await Setting.findOne({
    key: key
  });
  
  res.render("admin/pages/setting-api-login-social", {
    pageTitle: "Social Login API",
    record: record
  });
}

export const apiLoginSocialPatch = async (req: RequestAccount, res: Response) => {
  const key = "apiLoginSocial";

  await Setting.findOneAndUpdate(
    {
      key: key
    },
    {
      key: key,
      data: req.body,
      updatedBy: req.adminId
    },
    {
      upsert: true, // Create a new record if not found
    }
  );
  
  res.json({
    code: "success",
    message: "Updated successfully!"
  })
}

export const apiAppPassword = async (req: Request, res: Response) => { 
  const key = "apiAppPassword";

  const record = await Setting.findOne({
    key: key
  });
  
  res.render("admin/pages/setting-api-app-password", {
    pageTitle: "Google App Password API",
    record: record
  });
}

export const apiAppPasswordPatch = async (req: RequestAccount, res: Response) => {
  const key = "apiAppPassword";

  await Setting.findOneAndUpdate(
    {
      key: key
    },
    {
      key: key,
      data: req.body,
      updatedBy: req.adminId
    },
    {
      upsert: true, // Create a new record if not found
    }
  );
  
  res.json({
    code: "success",
    message: "Updated successfully!"
  })
}

export const general = async (req: Request, res: Response) => { 
  const key = "general";

  const record = await Setting.findOne({
    key: key
  });
  
  res.render("admin/pages/setting-general", {
    pageTitle: "General Settings",
    record: record
  });
}

export const generalPatch = async (req: RequestAccount, res: Response) => {
  const key = "general";

  await Setting.findOneAndUpdate(
    {
      key: key
    },
    {
      key: key,
      data: req.body,
      updatedBy: req.adminId
    },
    {
      upsert: true, // Create a new record if not found
    }
  );
  
  logAdminAction(req, "Updated general settings");

  res.json({
    code: "success",
    message: "Updated successfully!"
  })
}

export const removeCachePatch = async (req: RequestAccount, res: Response) => {
  const key = "assetVersion";

  await Setting.findOneAndUpdate(
    {
      key: key
    },
    {
      key: key,
      data: {
        assetVersion: Date.now()
      },
      updatedBy: req.adminId
    },
    {
      upsert: true, // Create a new record if not found
    }
  );
  
  logAdminAction(req, "Cleared asset cache");

  res.json({
    code: "success",
    message: "Cache cleared successfully!"
  })
}