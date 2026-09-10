import mongoose from "mongoose";

const SeoSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    keywords: [String],
    robots: {
      index: {
        type: Boolean,
        default: true
      },
      follow: {
        type: Boolean,
        default: true
      },
    },
    og: {
      title: String,
      description: String,
      image: String,
    }
  },
  {
    _id: false,
  }
);

export default SeoSchema;
