import mongoose from 'mongoose';
import AccountUser from '../../models/account-user.model';
import VerifyOTP from '../../models/verify-otp.model';
import { toSearchText } from '../../helpers/slugify.helper';
import UserAddress from '../../models/user-address.model';
import FormData from 'form-data';
import axios from 'axios';
import { domainCDN } from '../../configs/variable.config';
import Order from '../../models/order.model';
import Review from '../../models/review.model';
import Product from '../../models/product.model';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { generateRandomNumber } from '../../helpers/generate.helper';
import { sendMail, emailTemplates } from '../../helpers/mail.helper';
import { IOrder, IOrderItem } from '../../interfaces/models/order.interface';
import { IUserAddressInput } from '../../interfaces/models/user-address.interface';

export const getDashboardOverview = async (userId: string) => {
  const [totalOrders, totalCompletedOrders, totalReviews, orderList] = await Promise.all([
    Order.countDocuments({ userId, deleted: false }),
    Order.countDocuments({ userId, orderStatus: "completed", deleted: false }),
    Review.countDocuments({ userId }),
    Order.find({ userId, deleted: false })
      .select("_id code total orderStatus paymentStatus createdAt")
      .sort({ createdAt: "desc" })
      .limit(5)
  ]);

  return {
    totalOrders,
    totalCompletedOrders,
    totalReviews,
    orderList
  };
};

export const updateProfile = async (
  userId: string,
  currentEmail: string,
  fullName: string,
  phone?: string
) => {
  if (phone) {
    const existPhone = await AccountUser.findOne({
      _id: { $ne: userId },
      phone,
      deleted: false
    }).select("_id");
    if (existPhone) {
      return { success: false, message: "Phone number already exists!" };
    }
  }

  await AccountUser.updateOne(
    { _id: userId },
    {
      fullName,
      phone,
      search: toSearchText(`${fullName} ${currentEmail} ${phone || ''}`)
    }
  );

  return { success: true, message: "Update successful!" };
};

export const requestChangeEmail = async (
  userId: string,
  oldEmail: string,
  newEmail: string
) => {
  if (newEmail === oldEmail) {
    return { success: false, message: "New email must be different from your current email!" };
  }

  const emailTaken = await AccountUser.findOne({
    email: newEmail,
    deleted: false,
    _id: { $ne: userId }
  }).select("_id");

  if (emailTaken) {
    return { success: false, message: "This email is already in use by another account!" };
  }

  const otp = generateRandomNumber(6);

  await VerifyOTP.findOneAndUpdate(
    { userId, type: "otp-email-change" },
    { $set: { email: newEmail, otp, newEmail, expireAt: new Date(Date.now() + 10 * 60 * 1000) } },
    { upsert: true }
  );

  const { subject: subjectNew, html: htmlNew } = await emailTemplates.emailChangeOtp(`${otp}`, newEmail);
  try {
    await sendMail(newEmail, subjectNew, htmlNew);
  } catch (mailErr) {
    console.error("[changeEmail] sendMail failed, rolling back OTP:", mailErr);
    await VerifyOTP.deleteOne({ userId, type: "otp-email-change" });
    return { success: false, message: "Failed to send verification email. Please try again." };
  }

  void emailTemplates.emailChangeSecurityAlert(newEmail)
    .then(({ subject, html }) => sendMail(oldEmail, subject, html))
    .catch(() => {});

  return { success: true, message: "Verification code sent to your new email address!" };
};

export const verifyChangeEmail = async (userId: string, fullName: string, phone: string | undefined, otp: string) => {
  const record = await VerifyOTP.findOneAndDelete({
    userId,
    otp: `${otp}`,
    type: "otp-email-change",
    expireAt: { $gt: new Date() }
  });

  if (!record) {
    return { success: false, message: "Invalid or expired OTP code!" };
  }

  const newEmail = record.newEmail as string;

  await AccountUser.updateOne(
    { _id: userId },
    {
      email: newEmail,
      search: toSearchText(`${fullName} ${newEmail} ${phone || ''}`)
    }
  );

  return { success: true, message: "Email changed successfully! Please log in again with your new email." };
};

export const getUserAddresses = async (userId: string) => {
  return UserAddress.find({ userId })
    .select("_id name phone address province district ward type isDefault")
    .sort({ createdAt: "desc" });
};

export const createUserAddress = async (userId: string, addressData: IUserAddressInput): Promise<{ success: boolean; message: string }> => {
  addressData.userId = userId;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (addressData.isDefault) {
        await UserAddress.findOneAndUpdate(
          { userId, isDefault: true },
          { isDefault: false },
          { session }
        );
      }

      const newRecord = new UserAddress(addressData);
      await newRecord.save({ session });
    });
  } finally {
    session.endSession();
  }

  return { success: true, message: "Address added successfully!" };
};

export const setDefaultUserAddress = async (userId: string, addressId: string) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await UserAddress.findOneAndUpdate(
        { userId, isDefault: true },
        { isDefault: false },
        { session }
      );

      await UserAddress.findOneAndUpdate(
        { _id: addressId, userId },
        { isDefault: true },
        { session }
      );
    });
  } finally {
    session.endSession();
  }

  return { success: true, message: "Address set as default!" };
};

export const deleteUserAddress = async (userId: string, addressId: string) => {
  await UserAddress.findOneAndDelete({ _id: addressId, userId });
  return { success: true, message: "Address deleted successfully!" };
};

export const getUserAddressDetail = async (userId: string, addressId: string) => {
  return UserAddress.findOne({ _id: addressId, userId });
};

export const updateUserAddress = async (userId: string, addressId: string, addressData: IUserAddressInput): Promise<{ success: boolean; message: string }> => {
  const existAddress = await UserAddress.findOne({ _id: addressId, userId }).select("_id");
  if (!existAddress) {
    return { success: false, message: "Address does not exist!" };
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (addressData.isDefault) {
        await UserAddress.findOneAndUpdate(
          { userId, isDefault: true },
          { isDefault: false },
          { session }
        );
      }

      await UserAddress.updateOne({ _id: addressId, userId }, addressData, { session });
    });
  } finally {
    session.endSession();
  }

  return { success: true, message: "Address updated successfully!" };
};

export const updateAvatar = async (userId: string, file: Express.Multer.File, oldAvatar?: string) => {
  const formData = new FormData();
  formData.append('files', file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype
  });
  formData.append('folderPath', `users/${userId}`);

  const response = await axios.post(`${domainCDN}/file-manager/upload`, formData, {
    headers: {
      ...formData.getHeaders(),
      Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
    }
  });

  if (response.data.code === "success") {
    const avatar = response.data.saveLinks[0];
    const linkAvatar = `${avatar.folder}/${avatar.filename}`;

    await AccountUser.updateOne({ _id: userId }, { avatar: linkAvatar });

    if (oldAvatar) {
      const lastSlashIndex = oldAvatar.lastIndexOf("/");
      const folder = oldAvatar.substring(0, lastSlashIndex);
      const fileName = oldAvatar.substring(lastSlashIndex + 1);
      const formDataDelete = new FormData();
      formDataDelete.append("folder", folder);
      formDataDelete.append("fileName", fileName);

      axios.patch(`${domainCDN}/file-manager/delete-file`, formDataDelete, {
        headers: {
          ...formDataDelete.getHeaders(),
          Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
        }
      }).catch(() => {});
    }

    return { success: true, message: "Avatar updated successfully!", linkAvatar };
  }

  return { success: false, message: "Upload error!" };
};

export const getOrderHistory = async (userId: string, rawPage: unknown) => {
  const find = { userId, deleted: false };
  const limitItems = PAGINATION.DASHBOARD_ORDER_LIMIT;
  const totalRecord = await Order.countDocuments(find);
  const pagination = getPagination(rawPage, limitItems, totalRecord);

  const orderList = await Order
    .find(find)
    .select("_id code total orderStatus paymentStatus paymentMethod createdAt")
    .sort({ createdAt: "desc" })
    .limit(limitItems)
    .skip(pagination.skip);

  return {
    orderList,
    pagination
  };
};

export const getOrderDetailForUser = async (userId: string, orderId: string) => {
  return Order.findOne({ _id: orderId, userId, deleted: false });
};

export const getOrderReviewData = async (userId: string, orderId: string) => {
  const orderDetail: IOrder | null = await Order.findOne({
    _id: orderId,
    userId,
    deleted: false
  });

  if (!orderDetail) return null;

  const itemIds = orderDetail.items.map((item) => item.id || String(item._id || ""));
  const reviews = await Review.find({ userId, orderItemId: { $in: itemIds } });
  const reviewMap = new Map(reviews.map((r) => [String(r.orderItemId), r]));
  for (const item of orderDetail.items) {
    const review = reviewMap.get(String(item.id || item._id || ""));
    if (review) item.review = review;
  }

  return orderDetail;
};

export const submitOrderReview = async (
  userId: string,
  orderId: string,
  orderItemId: string,
  rating: string | number,
  comment?: string,
  files?: Express.Multer.File[]
) => {
  const orderDetail: IOrder | null = await Order.findOne({
    _id: orderId,
    userId,
    deleted: false
  });

  if (!orderDetail) {
    return { success: false, message: "Invalid data!" };
  }

  if (orderDetail.orderStatus !== "completed") {
    return { success: false, message: "You can only review products from completed orders!" };
  }

  const orderItem = orderDetail.items.find((item: IOrderItem) => item.id === orderItemId);
  if (!orderItem) {
    return { success: false, message: "Invalid data!" };
  }

  const productId = orderItem.productId;
  const variant = orderItem.variant;

  const existReview = await Review.findOne({
    userId,
    orderItemId
  }).select("_id");

  if (existReview) {
    return { success: false, message: "You have already reviewed this product!" };
  }

  const maxImages = 5;
  if (files && files.length > maxImages) {
    return { success: false, message: `You can only upload up to ${maxImages} images!` };
  }

  const maxSizePerImage = 5 * 1024 * 1024;
  if (files) {
    for (const file of files) {
      if (file.size > maxSizePerImage) {
        return { success: false, message: `Each image must not exceed ${maxSizePerImage / (1024 * 1024)} MB!` };
      }
    }
  }

  const imageLinks: string[] = [];
  if (files && files.length > 0) {
    const uploadPromises = files.map(async (file) => {
      const formData = new FormData();
      formData.append('files', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
      formData.append('folderPath', `reviews/${userId}`);
      const response = await axios.post(`${domainCDN}/file-manager/upload`, formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
        }
      });
      if (response.data.code === "success") {
        const savedLink = response.data.saveLinks[0];
        return `${savedLink.folder}/${savedLink.filename}`;
      }
      return null;
    });

    const uploadedFiles = await Promise.all(uploadPromises);
    for (const link of uploadedFiles) {
      if (link) imageLinks.push(link);
    }
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const newReview = new Review({
        userId,
        orderId,
        orderItemId,
        productId,
        variant,
        rating: parseInt(`${rating}`),
        comment,
        images: imageLinks
      });
      await newReview.save({ session });

      const product = await Product.findOne({ _id: productId, deleted: false }, null, { session });
      if (product) {
        const newRatingCount = product.ratingCount + 1;
        const newRatingAvg = ((product.ratingAvg * product.ratingCount) + parseInt(`${rating}`)) / newRatingCount;
        product.ratingAvg = newRatingAvg;
        product.ratingCount = newRatingCount;
        await product.save({ session });
      }
    });
  } finally {
    session.endSession();
  }

  return { success: true, message: "Thank you for reviewing the product!" };
};
