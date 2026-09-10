import { Request, Response } from "express";
import * as contactInquiryService from "../../services/admin/contact-inquiry.service";

export const about = (_req: Request, res: Response) => {
  res.render("client/pages/about", { pageTitle: "About Us" });
};

export const contact = (_req: Request, res: Response) => {
  res.render("client/pages/contact", { pageTitle: "Contact Us" });
};

export const privacyPolicy = (_req: Request, res: Response) => {
  res.render("client/pages/privacy-policy", { pageTitle: "Privacy Policy" });
};

export const termsAndConditions = (_req: Request, res: Response) => {
  res.render("client/pages/terms-and-conditions", { pageTitle: "Terms & Conditions" });
};

export const returnPolicy = (_req: Request, res: Response) => {
  res.render("client/pages/return-policy", { pageTitle: "Return Policy" });
};

export const faq = (_req: Request, res: Response) => {
  res.render("client/pages/faq", { pageTitle: "FAQ" });
};

export const contactPost = async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message } = req.body;
    await contactInquiryService.createContactInquiry({ name, email, subject, message });
    res.json({ code: "success", message: "Your message has been sent. We'll get back to you soon!" });
  } catch (error) {
    console.error("Error in contactPost:", error);
    res.json({ code: "error", message: "An error occurred while saving your inquiry. Please try again." });
  }
};
