import express from "express";
import mongoose from "mongoose";
import VideoChunk from "../models/VideoChunk.js";

const router = express.Router();

function getBucket() {
  if (!mongoose.connection || !mongoose.connection.db) {
    throw new Error("MongoDB connection not ready");
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "videos",
  });
}

/**
 * POST /api/videos/upload-direct
 * Direct upload for smaller videos / shorts (single-shot)
 */
router.post("/upload-direct", async (req, res) => {
  try {
    const { fileData, fileName, contentType, metadata } = req.body;
    if (!fileData) {
      return res.status(400).json({ message: "No video file data provided" });
    }

    const cleanBase64 = fileData.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    const bucket = getBucket();
    const safeFileName = fileName || `video-${Date.now()}.mp4`;
    const resolvedType = contentType || "video/mp4";

    const uploadStream = bucket.openUploadStream(safeFileName, {
      contentType: resolvedType,
      metadata: metadata || {},
    });

    uploadStream.on("error", (err) => {
      console.error("GridFS direct upload error:", err);
      return res.status(500).json({ message: "Failed to save video to cloud", error: err.message });
    });

    uploadStream.on("finish", () => {
      const fileId = uploadStream.id.toString();
      const videoUrl = `/api/videos/stream/${fileId}`;
      return res.status(201).json({
        success: true,
        fileId,
        videoUrl,
        fileName: safeFileName,
        size: buffer.length,
      });
    });

    uploadStream.end(buffer);
  } catch (error) {
    console.error("upload-direct error:", error);
    res.status(500).json({ message: "Failed to upload video", error: error.message });
  }
});

/**
 * POST /api/videos/upload-chunk
 * Saves an individual chunk (~2MB) to MongoDB temporary chunks collection
 */
router.post("/upload-chunk", async (req, res) => {
  try {
    const { uploadId, chunkIndex, totalChunks, chunkData } = req.body;

    if (!uploadId || chunkIndex === undefined || !totalChunks || !chunkData) {
      return res.status(400).json({ message: "Missing required chunk parameters" });
    }

    await VideoChunk.findOneAndUpdate(
      { uploadId, chunkIndex },
      { uploadId, chunkIndex, totalChunks, data: chunkData },
      { upsert: true, returnDocument: 'after' }
    );

    return res.json({ success: true, chunkIndex, totalChunks });
  } catch (error) {
    console.error("upload-chunk error:", error);
    res.status(500).json({ message: "Failed to upload chunk", error: error.message });
  }
});

/**
 * POST /api/videos/complete-upload
 * Assembles all chunks into GridFS bucket permanently and cleans up temp chunks
 */
router.post("/complete-upload", async (req, res) => {
  try {
    const { uploadId, fileName, contentType, metadata } = req.body;

    if (!uploadId) {
      return res.status(400).json({ message: "uploadId is required" });
    }

    const chunks = await VideoChunk.find({ uploadId }).sort({ chunkIndex: 1 });

    if (!chunks || chunks.length === 0) {
      return res.status(404).json({ message: "No chunks found for this upload" });
    }

    const expectedTotal = chunks[0].totalChunks;
    if (chunks.length !== expectedTotal) {
      return res.status(400).json({
        message: `Incomplete upload. Received ${chunks.length} of ${expectedTotal} chunks.`,
      });
    }

    const bucket = getBucket();
    const safeFileName = fileName || `video-${Date.now()}.mp4`;
    const resolvedType = contentType || "video/mp4";

    const uploadStream = bucket.openUploadStream(safeFileName, {
      contentType: resolvedType,
      metadata: metadata || {},
    });

    uploadStream.on("error", (err) => {
      console.error("GridFS chunk assembly error:", err);
      return res.status(500).json({ message: "Failed to assemble video stream", error: err.message });
    });

    uploadStream.on("finish", async () => {
      try {
        await VideoChunk.deleteMany({ uploadId });
      } catch (cleanErr) {
        console.warn("Failed to clean up temp chunks:", cleanErr);
      }

      const fileId = uploadStream.id.toString();
      const videoUrl = `/api/videos/stream/${fileId}`;
      return res.status(201).json({
        success: true,
        fileId,
        videoUrl,
        fileName: safeFileName,
      });
    });

    // Write all chunk buffers sequentially to GridFS
    for (const chunk of chunks) {
      const cleanBase64 = chunk.data.replace(/^data:[^;]+;base64,/, "");
      const buf = Buffer.from(cleanBase64, "base64");
      uploadStream.write(buf);
    }

    uploadStream.end();
  } catch (error) {
    console.error("complete-upload error:", error);
    res.status(500).json({ message: "Failed to complete video upload", error: error.message });
  }
});

/**
 * GET /api/videos/stream/:id
 * Ultra-fast HTTP 206 Partial Content byte-range video streaming from MongoDB GridFS
 * Enables instant playback, rewind, forward seeking across all devices & browsers.
 */
router.get("/stream/:id", async (req, res) => {
  try {
    const rawId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(rawId)) {
      return res.status(400).json({ message: "Invalid video stream ID" });
    }

    const fileId = new mongoose.Types.ObjectId(rawId);
    const bucket = getBucket();

    const files = await bucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: "Video not found in cloud storage" });
    }

    const file = files[0];
    const fileSize = file.length;
    const contentType = file.contentType || "video/mp4";
    const range = req.headers.range;

    // CORS & Cross-Origin-Resource-Policy for video tags & WebSockets
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      // Default to 4MB chunk chunking window if end not specified for fast buffering
      const maxChunk = 4 * 1024 * 1024;
      let end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + maxChunk - 1, fileSize - 1);

      if (isNaN(start) || start >= fileSize) {
        res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
        return res.end();
      }

      end = Math.min(end, fileSize - 1);
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": contentType,
      });

      const downloadStream = bucket.openDownloadStream(fileId, {
        start,
        end: end + 1,
      });

      downloadStream.on("error", (err) => {
        console.error("Stream range error:", err);
        if (!res.headersSent) res.status(500).end();
      });

      downloadStream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
      });

      const downloadStream = bucket.openDownloadStream(fileId);

      downloadStream.on("error", (err) => {
        console.error("Stream full error:", err);
        if (!res.headersSent) res.status(500).end();
      });

      downloadStream.pipe(res);
    }
  } catch (error) {
    console.error("stream error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Streaming error", error: error.message });
    }
  }
});

/**
 * DELETE /api/videos/:id
 * Removes video file from GridFS bucket
 */
router.delete("/:id", async (req, res) => {
  try {
    const rawId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(rawId)) {
      return res.status(400).json({ message: "Invalid video ID" });
    }

    const fileId = new mongoose.Types.ObjectId(rawId);
    const bucket = getBucket();
    await bucket.delete(fileId);

    return res.json({ success: true, message: "Video deleted successfully from MongoDB" });
  } catch (error) {
    console.error("delete video error:", error);
    res.status(500).json({ message: "Failed to delete video", error: error.message });
  }
});

export default router;
