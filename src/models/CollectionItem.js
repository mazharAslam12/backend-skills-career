import mongoose from "mongoose";

const collectionItemSchema = new mongoose.Schema(
  {
    collectionName: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    assignedTo: {
      type: [String],
      default: [],
      index: true,
    },
    fileData: {
      type: String, // Base64
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

collectionItemSchema.index({ collectionName: 1, createdAt: -1 });
collectionItemSchema.index({ collectionName: 1, "data.senderId": 1 });
collectionItemSchema.index({ collectionName: 1, "data.receiverId": 1 });
collectionItemSchema.index({ collectionName: 1, "data.chatId": 1 });

const CollectionItem = mongoose.model("CollectionItem", collectionItemSchema);

export default CollectionItem;

