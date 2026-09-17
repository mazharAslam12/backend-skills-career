import mongoose from "mongoose";

const videoChunkSchema = new mongoose.Schema(
  {
    uploadId: {
      type: String,
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    totalChunks: {
      type: Number,
      required: true,
    },
    data: {
      type: String, // base64 string of chunk
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 3600, // auto clean after 1 hour if abandoned
    },
  },
  { timestamps: true }
);

videoChunkSchema.index({ uploadId: 1, chunkIndex: 1 }, { unique: true });

const VideoChunk = mongoose.model("VideoChunk", videoChunkSchema);

export default VideoChunk;
