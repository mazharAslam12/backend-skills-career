import express from "express";
import CollectionItem from "../models/CollectionItem.js";

const router = express.Router();

router.get("/:collection", async (req, res) => {
  try {
    const collection = req.params.collection.toLowerCase();
    const userId = req.query.userId;

    let query = { collectionName: collection };
    if (userId) {
      query.$or = [
        { assignedTo: userId },
        { assignedTo: { $size: 0 } },
        { assignedTo: { $exists: false } },
        { assignedTo: null }
      ];
    }

    const items = await CollectionItem.find(query).sort({ createdAt: -1 });
    res.json(
      items.map((item) => ({
        id: item._id.toString(),
        assignedTo: item.assignedTo,
        fileName: item.fileName,
        fileData: item.fileData,
        ...item.data,
      })),
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch collection items", error: error.message });
  }
});

router.post("/:collection", async (req, res) => {
  try {
    const collection = req.params.collection.toLowerCase();
    const { assignedTo, fileData, fileName, ...data } = req.body;

    const item = await CollectionItem.create({
      collectionName: collection,
      data: data,
      assignedTo: assignedTo || [],
      fileData: fileData || null,
      fileName: fileName || null,
    });
    res.status(201).json({
      id: item._id.toString(),
      assignedTo: item.assignedTo,
      fileName: item.fileName,
      fileData: item.fileData,
      ...item.data,
    });
  } catch (error) {
    res.status(400).json({ message: "Failed to create collection item", error: error.message });
  }
});

router.put("/:collection/:id", async (req, res) => {
  try {
    const { assignedTo, fileData, fileName, ...data } = req.body;

    // Build $set using dot-notation to PATCH individual fields inside data,
    // NOT replace the whole data object (which would wipe senderId, content, etc.)
    const setFields = {};
    Object.keys(data).forEach(key => {
      setFields[`data.${key}`] = data[key];
    });

    // Also update top-level fields if provided
    setFields.collectionName = req.params.collection.toLowerCase();
    if (assignedTo !== undefined) setFields.assignedTo = assignedTo;
    if (fileData !== undefined) setFields.fileData = fileData;
    if (fileName !== undefined) setFields.fileName = fileName;

    const updated = await CollectionItem.findByIdAndUpdate(
      req.params.id,
      { $set: setFields },
      { new: true, runValidators: true },
    );
    if (!updated) {
      return res.status(404).json({ message: "Collection item not found" });
    }
    return res.json({
      id: updated._id.toString(),
      assignedTo: updated.assignedTo,
      fileName: updated.fileName,
      fileData: updated.fileData,
      ...updated.data,
    });
  } catch (error) {
    return res.status(400).json({ message: "Failed to update collection item", error: error.message });
  }
});

router.delete("/:collection/:id", async (req, res) => {
  try {
    const deleted = await CollectionItem.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Collection item not found" });
    }
    return res.json({ message: "Collection item deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete collection item", error: error.message });
  }
});

export default router;
