import ContactInquiry from '../../models/contact-inquiry.model';
import { IContactInquiry, IContactInquiryInput } from '../../interfaces/models/contact-inquiry.interface';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { escapeRegex } from '../../helpers/generate.helper';

export const getContactInquiryList = async (rawKeyword?: unknown, rawPage?: unknown) => {
  await ContactInquiry.updateMany(
    { deleted: { $exists: false } },
    { $set: { deleted: false } }
  );

  const find: Record<string, unknown> = {
    deleted: { $ne: true }
  };

  if (rawKeyword) {
    const keyword = `${rawKeyword}`.trim();
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.$or = [
      { name: keywordRegex },
      { email: keywordRegex },
      { subject: keywordRegex }
    ];
  }

  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await ContactInquiry.countDocuments(find);
  const pagination = getPagination(rawPage, limitItems, totalRecord);

  const recordList = await ContactInquiry
    .find(find)
    .select("_id name email subject message read createdAt")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({ createdAt: "desc" });

  return {
    recordList,
    pagination
  };
};

export const softDeleteContactInquiry = async (id: string) => {
  await ContactInquiry.updateOne({ _id: id }, { deleted: true, deletedAt: Date.now() });
  return { success: true, message: "Inquiry moved to trash successfully!" };
};

export const changeContactInquiryReadStatus = async (id: string, isRead: boolean) => {
  await ContactInquiry.updateOne(
    { _id: id, deleted: { $ne: true } },
    { read: isRead }
  );
  return { success: true, message: "Read status updated successfully!" };
};

export const softDeleteManyContactInquiries = async (ids: string[]) => {
  await ContactInquiry.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
  return { success: true, message: `Moved ${ids.length} inquiry(s) to trash!` };
};

export const getContactInquiryTrash = async () => {
  return ContactInquiry.find({ deleted: true })
    .select("_id name email subject status deletedAt")
    .sort({ deletedAt: "desc" });
};

export const restoreContactInquiry = async (id: string) => {
  await ContactInquiry.updateOne({ _id: id }, { deleted: false });
  return { success: true, message: "Inquiry restored successfully!" };
};

export const restoreManyContactInquiries = async (ids: string[]) => {
  await ContactInquiry.updateMany({ _id: { $in: ids } }, { deleted: false });
  return { success: true, message: `Restored ${ids.length} inquiry(s)!` };
};

export const permanentlyDeleteContactInquiry = async (id: string) => {
  await ContactInquiry.deleteOne({ _id: id });
  return { success: true, message: "Inquiry permanently deleted!" };
};

export const permanentlyDeleteManyContactInquiries = async (ids: string[]) => {
  await ContactInquiry.deleteMany({ _id: { $in: ids } });
  return { success: true, message: `Deleted ${ids.length} inquiry(s) permanently!` };
};

export const createContactInquiry = async (data: IContactInquiryInput): Promise<IContactInquiry> => {
  return ContactInquiry.create(data);
};
