import express from "express";
import DataRecord from "../models/DataRecord.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const records = await DataRecord.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch records", error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const record = await DataRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }
    return res.json(record);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch record", error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const record = await DataRecord.create(req.body);
    res.status(201).json(record);
  } catch (error) {
    res.status(400).json({ message: "Failed to create record", error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const record = await DataRecord.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }
    return res.json(record);
  } catch (error) {
    return res.status(400).json({ message: "Failed to update record", error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const record = await DataRecord.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }
    return res.json({ message: "Record deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete record", error: error.message });
  }
});

import User from "../models/User.js";

router.get("/sitemap.xml", async (req, res) => {
  try {
    const users = await User.find({}, "_id updatedAt avatar name").limit(1000);
    const baseUrl = process.env.FRONTEND_URL || "https://skills-career.netlify.app";

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;
    
    xml += `  <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
    xml += `  <url><loc>${baseUrl}/login</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>\n`;
    xml += `  <url><loc>${baseUrl}/register</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>\n`;
    xml += `  <url><loc>${baseUrl}/dashboard</loc><changefreq>daily</changefreq><priority>0.8</priority></url>\n`;

    users.forEach((u) => {
      const lastMod = u.updatedAt ? new Date(u.updatedAt).toISOString().split('T')[0] : '2026-07-25';
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/student/${u._id}</loc>\n`;
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      if (u.avatar) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${u.avatar}</image:loc>\n`;
        xml += `      <image:title>${u.name || "Student"} - Skills Career Profile Image</image:title>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.header("Content-Type", "application/xml");
    return res.send(xml);
  } catch (error) {
    return res.status(500).send("Error generating sitemap");
  }
});

export default router;
