import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import dataRoutes from "./routes/dataRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import collectionRoutes from "./routes/collectionRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import User from "./models/User.js";

dotenv.config();

const app = express();

// Database Connection Middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("Database connection middleware error:", err);
    res.status(500).json({ message: "Database connection failed", error: err.message });
  }
});

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Resolve Google Login COOP issue
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

app.get("/", (req, res) => {
  res.json({
    message: "Skills Career backend is running",
    status: "ok",
  });
});

// Dynamic XML Sitemap Generator for Google Search Console Indexing
app.get("/sitemap.xml", async (req, res) => {
  try {
    const users = await User.find({}, "_id name avatar banner updatedAt createdAt");
    const baseUrl = process.env.FRONTEND_URL || "https://skills-career.netlify.app";

    const staticRoutes = [
      { url: "/", priority: "1.0", changefreq: "daily" },
      { url: "/login", priority: "0.8", changefreq: "monthly" },
      { url: "/register", priority: "0.8", changefreq: "monthly" },
      { url: "/terms", priority: "0.5", changefreq: "yearly" },
      { url: "/privacy", priority: "0.5", changefreq: "yearly" },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    // Static Pages
    staticRoutes.forEach(route => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${route.url}</loc>\n`;
      xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
      xml += `    <priority>${route.priority}</priority>\n`;
      xml += `  </url>\n`;
    });

    // Dynamic Student Profiles (Each separate ID as a Google Search index page)
    users.forEach(u => {
      const uId = u._id.toString();
      const lastMod = (u.updatedAt || u.createdAt || new Date()).toISOString();
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/student/${uId}</loc>\n`;
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.9</priority>\n`;
      if (u.avatar) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${u.avatar}</image:loc>\n`;
        xml += `      <image:title>${u.name || 'Student'} Profile Photo</image:title>\n`;
        xml += `    </image:image>\n`;
      }
      if (u.banner) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${u.banner}</image:loc>\n`;
        xml += `      <image:title>${u.name || 'Student'} Cover Banner</image:title>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.header("Content-Type", "application/xml");
    return res.status(200).send(xml);
  } catch (error) {
    console.error("Sitemap generation error:", error);
    res.status(500).send("Error generating sitemap");
  }
});

app.use("/api/data", dataRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/products", productRoutes);

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;

