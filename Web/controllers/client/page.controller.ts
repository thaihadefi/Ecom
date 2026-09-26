import { Request, Response } from "express";
import * as contactInquiryService from "../../services/admin/contact-inquiry.service";
import { sendCaughtError } from "../../helpers/http-response.helper";
import { getCachedSetting } from "../../configs/setting.config";
import { CONTENT_PAGES, ContentPageKey } from "../../configs/content-pages.config";
import { safeHtml } from "../../helpers/html-sanitize.helper";

// Shows the text saved in Settings > Page Content, or the page's default copy.
const renderContentPage = (key: ContentPageKey) => async (req: Request, res: Response) => {
  const page = CONTENT_PAGES.find((p) => p.key === key)!;
  const saved = (await getCachedSetting<Partial<Record<ContentPageKey, string>>>("pages"))[key];
  const content = safeHtml(saved);
  if (content) {
    res.render("client/pages/content-page", { pageTitle: page.title, pagePath: req.path, content });
    return;
  }
  res.render(page.view, { pageTitle: page.title });
};

export const about = renderContentPage("about");

export const contact = (_req: Request, res: Response) => {
  res.render("client/pages/contact", { pageTitle: "Contact Us" });
};

export const privacyPolicy = renderContentPage("privacyPolicy");

export const termsAndConditions = renderContentPage("termsAndConditions");

export const returnPolicy = renderContentPage("returnPolicy");

export const faq = renderContentPage("faq");

export const contactPost = async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message } = req.body;
    await contactInquiryService.createContactInquiry({ name, email, subject, message });
    res.json({ code: "success", message: "Your message has been sent. We'll get back to you soon!" });
  } catch (error) {
    console.error("Error in contactPost:", error);
    sendCaughtError(res, error, "An error occurred while saving your inquiry. Please try again.", "An error occurred while saving your inquiry. Please try again.");
  }
};
