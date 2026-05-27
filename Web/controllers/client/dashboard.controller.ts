import { Request, Response } from 'express';
import mongoose from 'mongoose';
import AccountUser from '../../models/account-user.model';
import VerifyOTP from '../../models/verify-otp.model';
import { toSearchText } from '../../helpers/slugify.helper';
import jwt from 'jsonwebtoken';
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

export const dashboard = async (req: Request, res: Response) => {
  const userId = res.locals.accountUser.id;

  // Total orders
  const totalOrders = await Order.countDocuments({
    userId: userId,
    deleted: false
  });

  // Successful delivery
  const totalCompletedOrders = await Order.countDocuments({
    userId: userId,
    orderStatus: "completed",
    deleted: false
  });

  // Total reviews
  const totalReviews = await Review.countDocuments({
    userId: userId
  });

  // Recent orders
  const orderList = await Order
    .find({ userId: userId, deleted: false })
    .select("_id code total orderStatus paymentStatus createdAt")
    .sort({ createdAt: "desc" })
    .limit(5)
  
  res.render("client/pages/dashboard", {
    pageTitle: "Overview",
    totalOrders,
    totalCompletedOrders,
    totalReviews,
    orderList,
  });
}

export const profile = (req: Request, res: Response) => {
  res.render("client/pages/dashboard-profile", {
    pageTitle: "Profile"
  });
}

export const profileEdit = (req: Request, res: Response) => {
  res.render("client/pages/dashboard-profile-edit", {
    pageTitle: "Edit Profile"
  });
}

export const profileEditPatch = async (req: Request, res: Response) => {
  try {
    const id = res.locals.accountUser.id;
    const currentEmail = res.locals.accountUser.email;

    if (req.body.phone) {
      const existPhone = await AccountUser.findOne({
        _id: { $ne: id },
        phone: req.body.phone,
        deleted: false
      }).select("_id");
      if (existPhone) {
        res.json({ code: "error", message: "Phone number already exists!" });
        return;
      }
    }

    const updateData: any = {
      fullName: req.body.fullName,
      phone: req.body.phone,
      search: toSearchText(`${req.body.fullName} ${currentEmail} ${req.body.phone}`)
    };

    await AccountUser.updateOne({ _id: id }, updateData);

    res.json({ code: "success", message: "Update successful!" });
  } catch (error) {
    console.error(error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const changeEmailRequestPost = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const oldEmail = res.locals.accountUser.email;
    const { newEmail } = req.body;

    if (newEmail === oldEmail) {
      res.json({ code: "error", message: "New email must be different from your current email!" });
      return;
    }

    const emailTaken = await AccountUser.findOne({ email: newEmail, deleted: false, _id: { $ne: userId } }).select("_id");
    if (emailTaken) {
      res.json({ code: "error", message: "This email is already in use by another account!" });
      return;
    }

    const otp = generateRandomNumber(6);

    // Upsert — replaces any existing pending request for this user
    await VerifyOTP.findOneAndUpdate(
      { userId, type: "otp-email-change" },
      { $set: { email: newEmail, otp, newEmail, expireAt: new Date(Date.now() + 10 * 60 * 1000) } },
      { upsert: true }
    );

    // Send OTP to new email (critical — rollback if it fails)
    const { subject: subjectNew, html: htmlNew } = await emailTemplates.emailChangeOtp(`${otp}`, newEmail);
    try {
      await sendMail(newEmail, subjectNew, htmlNew);
    } catch (mailErr) {
      console.error("[changeEmail] sendMail failed, rolling back OTP:", mailErr);
      await VerifyOTP.deleteOne({ userId, type: "otp-email-change" });
      res.json({ code: "error", message: "Failed to send verification email. Please try again." });
      return;
    }

    // Security alert to old email (fire-and-forget)
    void emailTemplates.emailChangeSecurityAlert(newEmail)
      .then(({ subject, html }) => sendMail(oldEmail, subject, html))
      .catch(() => {});

    res.json({ code: "success", message: "Verification code sent to your new email address!" });
  } catch (error) {
    console.error(error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const changeEmailVerifyPost = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const { otp } = req.body;

    // Atomic find-and-delete to prevent race conditions
    const record = await VerifyOTP.findOneAndDelete({
      userId,
      otp: `${otp}`,
      type: "otp-email-change",
      expireAt: { $gt: new Date() }
    });

    if (!record) {
      res.json({ code: "error", message: "Invalid or expired OTP code!" });
      return;
    }

    const newEmail = record.newEmail as string;

    await AccountUser.updateOne({ _id: userId }, {
      email: newEmail,
      search: toSearchText(`${res.locals.accountUser.fullName} ${newEmail} ${res.locals.accountUser.phone || ''}`)
    });

    // Clear session — user must log in again with new email
    const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
    res.clearCookie("tokenUser", cookieOpts);
    res.clearCookie("refreshToken", cookieOpts);

    res.json({ code: "success", message: "Email changed successfully! Please log in again with your new email." });
  } catch (error) {
    console.error(error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const changePassword = (req: Request, res: Response) => {
  res.redirect("/auth/forgot-password");
}

export const address = async (req: Request, res: Response) => {
  const id = res.locals.accountUser.id;

  const addressList = await UserAddress
    .find({ userId: id })
    .select("_id name phone address province district ward type")
    .sort({ createdAt: "desc" })

  res.render("client/pages/dashboard-address", {
    pageTitle: "Address List",
    addressList: addressList
  });
}

export const addressCreate = (req: Request, res: Response) => {
  res.render("client/pages/dashboard-address-create", {
    pageTitle: "Add Address"
  });
}

export const addressCreatePost = async (req: Request, res: Response) => {
  try {
    const id = res.locals.accountUser.id;

    req.body.userId = id;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if(req.body.isDefault) {
          await UserAddress.findOneAndUpdate({
            userId: id,
            isDefault: true
          }, {
            isDefault: false
          }, { session });
        }

        const newRecord = new UserAddress(req.body);
        await newRecord.save({ session });
      });
    } finally {
      session.endSession();
    }

    res.json({
      code: "success",
      message: "Address added successfully!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const addressChangeDefaultPatch = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const addressId = req.params.id;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Find current default address to unset default
        await UserAddress.findOneAndUpdate({
          userId: userId,
          isDefault: true
        }, {
          isDefault: false
        }, { session });

        // Set new address as default
        await UserAddress.findOneAndUpdate({
          _id: addressId,
          userId: userId,
          isDefault: false
        }, {
          isDefault: true
        }, { session });
      });
    } finally {
      session.endSession();
    }

    res.json({
      code: "success",
      message: "Address set as default!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const addressDelete = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const addressId = req.params.id;

    // Delete address
    await UserAddress.findOneAndDelete({
      _id: addressId,
      userId: userId
    });

    res.json({
      code: "success",
      message: "Address deleted successfully!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const addressEdit = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const addressId = req.params.id;

    const addressDetail = await UserAddress.findOne({
      _id: addressId,
      userId: userId,
    });

    if(!addressDetail) {
      res.redirect(`/dashboard/address`);
      return;
    }

    res.render("client/pages/dashboard-address-edit", {
      pageTitle: "Edit Address",
      addressDetail: addressDetail
    });
  } catch (error) {
    res.redirect(`/dashboard/address`);
  }
}

export const addressEditPatch = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const addressId = req.params.id;

    const existAddress = await UserAddress.findOne({
      _id: addressId,
      userId: userId,
    }).select("_id");

    if(!existAddress) {
      res.json({
        code: "error",
        message: "Address does not exist!"
      });
      return;
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if(req.body.isDefault) {
          await UserAddress.findOneAndUpdate({
            userId: userId,
            isDefault: true
          }, {
            isDefault: false
          }, { session });
        }

        await UserAddress.updateOne({
          _id: addressId,
          userId: userId,
        }, req.body, { session });
      });
    } finally {
      session.endSession();
    }

    res.json({
      code: "success",
      message: "Address updated successfully!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const profileChangeAvatarPatch = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const file = req.file;
    
    if(!file) {
      res.json({
        code: "error",
        message: "Please select a file!"
      })
      return;
    }

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
      } // Required for correct multipart/form-data sending
    });
    
    if(response.data.code == "success") {
      const avatar = response.data.saveLinks[0];
      const linkAvatar = `${avatar.folder}/${avatar.filename}`;

      await AccountUser.updateOne({
        _id: userId
      }, {
        avatar: linkAvatar
      });

      res.json({
        code: "success",
        message: "Avatar updated successfully!",
        linkAvatar: linkAvatar
      });

      // Delete old avatar file
      if(res.locals.accountUser.avatar) {
        const avatarOld = res.locals.accountUser.avatar;
        const lastSlashIndex = avatarOld.lastIndexOf("/");
        const folder = avatarOld.substring(0, lastSlashIndex);
        const fileName = avatarOld.substring(lastSlashIndex + 1);
        const formDataDelete = new FormData();
        formDataDelete.append("folder", folder);
        formDataDelete.append("fileName", fileName);

        axios.patch(`${domainCDN}/file-manager/delete-file`, formDataDelete, {
          headers: {
            ...formDataDelete.getHeaders(),
            Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
          } // Required for correct multipart/form-data sending
        });
      }

      return;
    } else {
      res.json({
        code: "error",
        message: "Upload error!"
      });
    }
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const orderList = async (req: Request, res: Response) => {
  const id = res.locals.accountUser.id;

  const find = { userId: id, deleted: false };

  // Pagination
  const limitItems = PAGINATION.DASHBOARD_ORDER_LIMIT;
  const totalRecord = await Order.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination

  const orderList = await Order
    .find(find)
    .select("_id code total orderStatus paymentStatus paymentMethod createdAt")
    .sort({ createdAt: "desc" })
    .limit(limitItems)
    .skip(pagination.skip);

  res.render("client/pages/dashboard-order-list", {
    pageTitle: "Order History",
    orderList: orderList,
    pagination: pagination
  });
}

export const orderDetail = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const orderId = req.params.id;

    const orderDetail = await Order.findOne({
      _id: orderId,
      userId: userId,
      deleted: false
    });

    if(!orderDetail) {
      res.redirect('/dashboard/order/list');
      return;
    }
    
    res.render("client/pages/dashboard-order-detail", {
      pageTitle: `Order Details: ${orderDetail.code}`,
      orderDetail: orderDetail
    });
  } catch (error) {
    res.redirect('/dashboard/order/list');
  }
}

export const orderReview = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const orderId = req.params.id;

    const orderDetail: any = await Order.findOne({
      _id: orderId,
      userId: userId,
      deleted: false
    });

    if(!orderDetail) {
      res.redirect('/dashboard/order/list');
      return;
    }

    // Get review status for each product in the order
    const itemIds = orderDetail.items.map((item: any) => item.id);
    const reviews = await Review.find({ userId: userId, orderItemId: { $in: itemIds } });
    const reviewMap = new Map(reviews.map((r: any) => [String(r.orderItemId), r]));
    for (const item of orderDetail.items) {
      const review = reviewMap.get(String(item.id));
      if (review) item.review = review;
    }

    res.render("client/pages/dashboard-order-review", {
      pageTitle: `Review Order: ${orderDetail.code}`,
      orderDetail: orderDetail
    });
  } catch (error) {
    res.redirect('/dashboard/order/list');
  }
}

export const orderReviewPost = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const { orderId, orderItemId, rating, comment } = req.body;
    const files = req.files as Express.Multer.File[];

    const orderDetail: any = await Order.findOne({
      _id: orderId,
      userId: userId,
      deleted: false
    });

    if(!orderDetail) {
      res.json({
        code: "error",
        message: "Invalid data!"
      });
      return;
    }

    // Only allow reviews for completed orders
    if(orderDetail.orderStatus !== "completed") {
      res.json({
        code: "error",
        message: "You can only review products from completed orders!"
      });
      return;
    }

    const orderItem = orderDetail.items.find((item: any) => item.id === orderItemId);
    if(!orderItem) {
      res.json({
        code: "error",
        message: "Invalid data!"
      });
      return;
    }

    const productId = orderItem.productId;
    const variant = orderItem.variant;

    // Check if user reviewed this product/order item already
    const existReview = await Review.findOne({
      userId: userId,
      orderItemId: orderItemId
    }).select("_id");

    if(existReview) {
      res.json({
        code: "error",
        message: "You have already reviewed this product!"
      });
      return;
    }

    // Maximum images count limit
    const maxImages = 5;
    if(files && files.length > maxImages) {
      res.json({
        code: "error",
        message: `You can only upload up to ${maxImages} images!`
      });
      return;
    }

    // Maximum file size limit (5MB)
    const maxSizePerImage = 5 * 1024 * 1024; // 5MB
    if(files) {
      for (const file of files) {
        if(file.size > maxSizePerImage) {
          res.json({
            code: "error",
            message: `Each image must not exceed ${maxSizePerImage / (1024 * 1024)} MB!`
          });
          return;
        }
      }
    }

    const imageLinks: string[] = [];
    // Process image uploads if any
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
          } // Required for correct multipart/form-data sending
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
    // Create review + update product rating atomically
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const newReview = new Review({
          userId,
          orderId,
          orderItemId,
          productId,
          variant,
          rating: parseInt(rating),
          comment,
          images: imageLinks
        });
        await newReview.save({ session });

        const product = await Product.findOne({ _id: productId, deleted: false }, null, { session });
        if (product) {
          const newRatingCount = product.ratingCount + 1;
          const newRatingAvg = ((product.ratingAvg * product.ratingCount) + parseInt(rating)) / newRatingCount;
          product.ratingAvg = newRatingAvg;
          product.ratingCount = newRatingCount;
          await product.save({ session });
        }
      });
    } finally {
      session.endSession();
    }

    res.json({
      code: "success",
      message: "Thank you for reviewing the product!"
    });
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}