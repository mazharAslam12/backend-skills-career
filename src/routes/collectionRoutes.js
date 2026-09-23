import express from "express";
import mongoose from "mongoose";
import CollectionItem from "../models/CollectionItem.js";

const router = express.Router();

const formatItem = (item) => ({
  _mongoId: item._id.toString(),
  ...item.data,
  id: item.data?.id || item._id.toString(),
  assignedTo: item.assignedTo,
  fileName: item.fileName,
  fileData: item.fileData,
  createdAt: item.data?.createdAt || item.createdAt,
  updatedAt: item.data?.updatedAt || item.updatedAt,
});

const findCollectionItem = async (collection, id) => {
  const rawCol = String(collection || '').toLowerCase();
  const isMsg = rawCol === 'message' || rawCol === 'messages';
  const isVid = rawCol === 'streamvideos' || rawCol === 'videos' || rawCol === 'streamvideo';
  const colFilter = isMsg ? { $in: ['message', 'messages'] } : (isVid ? { $in: ['streamvideos', 'videos', 'streamvideo'] } : rawCol);

  if (mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id) {
    const byMongoId = await CollectionItem.findOne({
      _id: id,
      collectionName: colFilter,
    });
    if (byMongoId) return byMongoId;
  }
  return CollectionItem.findOne({
    collectionName: colFilter,
    $or: [
      { "data.id": id },
      { "data._id": id },
      { "data.tempId": id },
      { "data.messageId": id },
      { "data._mongoId": id }
    ]
  });
};

router.get("/:collection", async (req, res) => {
  try {
    const rawCollection = req.params.collection.toLowerCase();
    const isMessageCol = (rawCollection === 'message' || rawCollection === 'messages');
    const isVideoCol = (rawCollection === 'streamvideos' || rawCollection === 'videos' || rawCollection === 'streamvideo');
    const collectionFilter = isMessageCol
      ? { $in: ['message', 'messages'] }
      : (isVideoCol ? { $in: ['streamvideos', 'videos', 'streamvideo'] } : rawCollection);

    const userId = req.query.userId;
    const includeFileData = req.query.includeFileData === 'true';

    let query = { collectionName: collectionFilter };
    const chatId = req.query.chatId;

    if (chatId) {
      query.$or = [
        { 'data.chatId': String(chatId) },
        { 'data.id': String(chatId) }
      ];
    } else if (userId) {
      if (isMessageCol) {
        query.$or = [
          { 'data.senderId': String(userId) },
          { 'data.receiverId': String(userId) },
          { 'data.chatId': { $regex: String(userId) } },
          { 'data.chatId': { $regex: 'group_' } },
          { 'data.chatId': 'ai_bot_chat' },
          { 'data.receiverId': 'ai_bot' },
          { 'data.members': String(userId) },
          { assignedTo: String(userId) },
        ];
      } else {
        query.$or = [
          { assignedTo: userId },
          { assignedTo: { $size: 0 } },
          { assignedTo: { $exists: false } },
          { assignedTo: null }
        ];
      }
    }

    // Exclude heavy binary fileData when listing streamvideos, attachmentsbook, or messages (instant load in ms instead of 50MB+ download)
    let projection = {};
    const lite = req.query.lite === 'true';
    if ((isVideoCol || rawCollection === 'attachmentsbook') && !includeFileData) {
      projection = { fileData: 0 };
    }
    if (isMessageCol && !includeFileData) {
      projection = { ...projection, fileData: 0 };
      if (lite) {
        projection['data.fileData'] = 0;
        projection['data.fileDataUrl'] = 0;
        projection['data.audioUrl'] = 0;
      }
    }

    let queryExec = CollectionItem.find(query, projection).sort({ createdAt: -1 });
    if (isMessageCol) {
      const limit = parseInt(req.query.limit, 10) || 2500;
      queryExec = queryExec.limit(limit);
    } else if (rawCollection === 'signals') {
      queryExec = queryExec.limit(50);
    }

    const items = await queryExec;
    res.json(items.map(formatItem));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch collection items", error: error.message });
  }
});

router.get("/:collection/:id", async (req, res) => {
  try {
    const rawCollection = req.params.collection.toLowerCase();
    const collection = (rawCollection === 'messages') ? 'message' : (rawCollection === 'videos' || rawCollection === 'streamvideo' ? 'streamvideos' : rawCollection);
    const item = await findCollectionItem(collection, req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Collection item not found" });
    }
    return res.json(formatItem(item));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch collection item", error: error.message });
  }
});

router.post("/:collection", async (req, res) => {
  try {
    const rawCollection = req.params.collection.toLowerCase();
    const collection = (rawCollection === 'messages') ? 'message' : (rawCollection === 'videos' || rawCollection === 'streamvideo' ? 'streamvideos' : rawCollection);
    const { assignedTo, fileData, fileName, ...data } = req.body;

    // Guard: MongoDB BSON document limit is 16MB.
    // Base64 encoding adds ~33% overhead, so 10MB raw = ~13.3MB base64 = safe.
    // Reject if fileData exceeds 12MB (base64 chars) to stay under BSON limit.
    if (fileData && fileData.length > 12 * 1024 * 1024) {
      return res.status(413).json({
        message: "File too large for cloud storage.",
        error: "Video files over ~9MB must be uploaded to YouTube first, then paste the YouTube link instead. This is the safest way to share videos on all devices."
      });
    }

    const item = await CollectionItem.create({
      collectionName: collection,
      data: data,
      assignedTo: assignedTo || [],
      fileData: fileData || null,
      fileName: fileName || null,
    });
    res.status(201).json(formatItem(item));
  } catch (error) {
    res.status(400).json({ message: "Failed to create collection item", error: error.message });
  }
});

router.put("/:collection/:id", async (req, res) => {
  try {
    const { assignedTo, fileData, fileName, ...data } = req.body;
    const rawCollection = req.params.collection.toLowerCase();
    const collection = (rawCollection === 'messages') ? 'message' : (rawCollection === 'videos' || rawCollection === 'streamvideo' ? 'streamvideos' : rawCollection);

    // Build $set using dot-notation to PATCH individual fields inside data,
    // NOT replace the whole data object (which would wipe senderId, content, etc.)
    const setFields = {};
    Object.keys(data).forEach(key => {
      setFields[`data.${key}`] = data[key];
    });

    // Also update top-level fields if provided
    setFields.collectionName = collection;
    if (assignedTo !== undefined) setFields.assignedTo = assignedTo;
    if (fileData !== undefined) setFields.fileData = fileData;
    if (fileName !== undefined) setFields.fileName = fileName;

    const existing = await findCollectionItem(collection, req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Collection item not found" });
    }

    const updated = await CollectionItem.findByIdAndUpdate(
      existing._id,
      { $set: setFields },
      { returnDocument: 'after', runValidators: true },
    );
    if (!updated) {
      return res.status(404).json({ message: "Collection item not found" });
    }
    return res.json(formatItem(updated));
  } catch (error) {
    return res.status(400).json({ message: "Failed to update collection item", error: error.message });
  }
});

router.delete("/:collection/:id", async (req, res) => {
  try {
    const rawCollection = req.params.collection.toLowerCase();
    const collection = (rawCollection === 'messages') ? 'message' : (rawCollection === 'videos' || rawCollection === 'streamvideo' ? 'streamvideos' : rawCollection);
    const existing = await findCollectionItem(collection, req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Collection item not found" });
    }
    await CollectionItem.findByIdAndDelete(existing._id);
    return res.json({ message: "Collection item deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete collection item", error: error.message });
  }
});

export default router;
