import mongoose from "mongoose";

const SeoSchema = new mongoose.Schema(
  {
    title: String, // Title displayed on Google search results
    description: String, // Short description displayed under the title on Google
    keywords: [String], // List of keywords related to the product
    robots: {
      index: { // Allow (true) or disallow (false) Google to index this page (Used to hide product from Google search)
        type: Boolean,
        default: true
      },
      follow: { // Allow (true) or disallow (false) Google to follow links in this page
        type: Boolean,
        default: true
      },
    },
    og: {
      title: String, // Title displayed when sharing links on social media
      description: String, // Description when sharing links on social media
      image: String, // Image displayed when sharing links on social media
    }
  },
  {
    _id: false, // Important: do not generate _id for sub-schema
  }
);

export default SeoSchema;