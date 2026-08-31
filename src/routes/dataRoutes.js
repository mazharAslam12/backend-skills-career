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
import CollectionItem from "../models/CollectionItem.js";

const toSlug = (text) => (text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

router.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || "https://skills-career.netlify.app";
    const users = await User.find({}, "_id name avatar banner updatedAt createdAt").limit(2000);
    const blogItems = await CollectionItem.find({ collectionName: "blogs" }).limit(50000);

    const staticRoutes = [
      { url: "/", priority: "1.0", changefreq: "daily" },
      { url: "/about", priority: "0.95", changefreq: "weekly" },
      { url: "/courses", priority: "0.95", changefreq: "weekly" },
      { url: "/curriculum", priority: "0.95", changefreq: "weekly" },
      { url: "/admissions", priority: "0.90", changefreq: "weekly" },
      { url: "/blogs", priority: "0.98", changefreq: "hourly" },
      { url: "/faq", priority: "0.85", changefreq: "monthly" },
      { url: "/contact", priority: "0.85", changefreq: "monthly" },
      { url: "/login", priority: "0.80", changefreq: "monthly" },
      { url: "/register", priority: "0.80", changefreq: "monthly" },
      { url: "/terms", priority: "0.50", changefreq: "yearly" },
      { url: "/privacy", priority: "0.50", changefreq: "yearly" },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;
    
    staticRoutes.forEach(r => {
      xml += `  <url><loc>${baseUrl}${r.url}</loc><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>\n`;
    });

    blogItems.forEach((item) => {
      const bData = item.data || {};
      const blogId = bData.id || item._id.toString();
      const slug = toSlug(bData.title) || blogId;
      const lastMod = (item.updatedAt || item.createdAt || new Date()).toISOString();
      const title = bData.title || "Blog Article";
      const image = bData.image || item.fileData || "";

      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/blogs/${slug}</loc>\n`;
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.95</priority>\n`;
      if (image && image.startsWith("http")) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${encodeURI(image)}</image:loc>\n`;
        xml += `      <image:title><![CDATA[${title}]]></image:title>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    });

    users.forEach((u) => {
      const lastMod = (u.updatedAt || u.createdAt || new Date()).toISOString();
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/student/${u._id}</loc>\n`;
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.85</priority>\n`;
      if (u.avatar && u.avatar.startsWith("http")) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${encodeURI(u.avatar)}</image:loc>\n`;
        xml += `      <image:title><![CDATA[${u.name || "Student"} - Skills Career Profile Image]]></image:title>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.header("Content-Type", "application/xml; charset=utf-8");
    res.header("Cache-Control", "public, max-age=3600, s-maxage=3600");
    return res.send(xml);
  } catch (error) {
    return res.status(500).send("Error generating sitemap");
  }
});

export default router;
