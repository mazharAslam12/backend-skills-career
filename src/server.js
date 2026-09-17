import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import dataRoutes from "./routes/dataRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import collectionRoutes from "./routes/collectionRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import recaptchaRoutes from "./routes/recaptchaRoutes.js";
import videoRoutes from "./routes/videoRoutes.js";
import User from "./models/User.js";

dotenv.config();

const app = express();

// 1. CORS MUST BE FIRST — Handles all routes and OPTIONS preflight requests in Express 5
app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
}));

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Resolve Google Login COOP issue
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

// 2. Database Connection Middleware
app.use(async (req, res, next) => {
  // Fast pass for preflight OPTIONS, root status, and health probes
  if (req.method === "OPTIONS" || req.path === "/" || req.path === "/health") {
    return next();
  }

  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("[DB Middleware Error]:", err.message);
    res.status(503).set("Retry-After", "3").json({
      message: "Database temporarily reconnecting. Please retry.",
      error: err.message
    });
  }
});


app.get("/", (req, res) => {
  res.json({
    message: "Skills Career backend is running",
    status: "ok",
  });
});

import CollectionItem from "./models/CollectionItem.js";

// Helper for slug generation
const toSlug = (text) => (text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Comprehensive Dynamic XML Sitemap Generator for Google Search Console & Image Indexing
app.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || "https://skills-career.netlify.app";
    const users = await User.find({}, "_id name avatar banner updatedAt createdAt").limit(2000);
    const blogItems = await CollectionItem.find({ collectionName: "blogs" }).limit(50000);
    const videoItems = await CollectionItem.find({ collectionName: "streamvideos" }).limit(50000);

    const staticRoutes = [
      { url: "/", priority: "1.0", changefreq: "daily", title: "Skills Career | Home" },
      { url: "/about", priority: "0.95", changefreq: "weekly", title: "About Skills Career & Mazhar DevX" },
      { url: "/courses", priority: "0.95", changefreq: "weekly", title: "Full Stack Courses & Programs" },
      { url: "/curriculum", priority: "0.95", changefreq: "weekly", title: "8-Module Software Engineering Curriculum" },
      { url: "/admissions", priority: "0.90", changefreq: "weekly", title: "Admissions & Enrollment" },
      { url: "/blogs", priority: "0.98", changefreq: "hourly", title: "Technology, Coding & Tech Price Blogs Archive" },
      { url: "/dashboard/skillscast", priority: "0.96", changefreq: "daily", title: "SkillsCast Studio & YouTube Cinema" },
      { url: "/faq", priority: "0.85", changefreq: "monthly", title: "Frequently Asked Questions" },
      { url: "/contact", priority: "0.85", changefreq: "monthly", title: "Contact & Mentorship Support" },
      { url: "/login", priority: "0.80", changefreq: "monthly", title: "Student Portal Login" },
      { url: "/register", priority: "0.80", changefreq: "monthly", title: "Student Registration" },
      { url: "/terms", priority: "0.50", changefreq: "yearly", title: "Terms of Service" },
      { url: "/privacy", priority: "0.50", changefreq: "yearly", title: "Privacy Policy" },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n`;

    // 1. Static Pages
    staticRoutes.forEach(route => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${route.url}</loc>\n`;
      xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
      xml += `    <priority>${route.priority}</priority>\n`;
      xml += `  </url>\n`;
    });

    // 2. Dynamic Blog Posts from MongoDB Collection
    blogItems.forEach(item => {
      const bData = item.data || {};
      const blogId = bData.id || item._id.toString();
      const slug = toSlug(bData.title) || blogId;
      const lastMod = (item.updatedAt || item.createdAt || new Date()).toISOString();
      const title = bData.title || "Skills Career Technology Article";
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
        xml += `      <image:caption><![CDATA[${bData.summary || title}]]></image:caption>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    });

    // 3. Dynamic SkillsCast Masterclass Videos & Shorts for Google Video Indexing
    videoItems.forEach(item => {
      const v = item.data || {};
      const vidId = v.id || item._id.toString();
      const title = v.title || "SkillsCast Masterclass Video";
      const desc = v.description || title;
      const thumb = v.thumbnail || "https://skills-career.netlify.app/Skills-logo.png";
      const uploader = v.creatorName || "Skills Career Creator";
      const pubDate = (item.createdAt || new Date()).toISOString();
      const videoPageUrl = `${baseUrl}/dashboard/skillscast?v=${vidId}`;
      const contentUrl = v.videoUrl?.startsWith("http") ? v.videoUrl : `${baseUrl}${v.videoUrl || ""}`;

      xml += `  <url>\n`;
      xml += `    <loc>${videoPageUrl}</loc>\n`;
      xml += `    <lastmod>${(item.updatedAt || item.createdAt || new Date()).toISOString()}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.92</priority>\n`;
      xml += `    <video:video>\n`;
      xml += `      <video:thumbnail_loc>${encodeURI(thumb)}</video:thumbnail_loc>\n`;
      xml += `      <video:title><![CDATA[${title}]]></video:title>\n`;
      xml += `      <video:description><![CDATA[${desc.slice(0, 2048)}]]></video:description>\n`;
      if (contentUrl && contentUrl.startsWith("http")) {
        xml += `      <video:content_loc>${encodeURI(contentUrl)}</video:content_loc>\n`;
      }
      xml += `      <video:player_loc>${videoPageUrl}</video:player_loc>\n`;
      xml += `      <video:publication_date>${pubDate}</video:publication_date>\n`;
      xml += `      <video:family_friendly>yes</video:family_friendly>\n`;
      xml += `      <video:uploader info="${baseUrl}">${uploader}</video:uploader>\n`;
      xml += `    </video:video>\n`;
      xml += `  </url>\n`;
    });

    // 4. Dynamic Student Profiles
    users.forEach(u => {
      const uId = u._id.toString();
      const lastMod = (u.updatedAt || u.createdAt || new Date()).toISOString();
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/student/${uId}</loc>\n`;
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.85</priority>\n`;
      if (u.avatar && u.avatar.startsWith("http")) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${encodeURI(u.avatar)}</image:loc>\n`;
        xml += `      <image:title><![CDATA[${u.name || "Student"} Profile Photo]]></image:title>\n`;
        xml += `    </image:image>\n`;
      }
      if (u.banner && u.banner.startsWith("http")) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${encodeURI(u.banner)}</image:loc>\n`;
        xml += `      <image:title><![CDATA[${u.name || "Student"} Cover Banner]]></image:title>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    });


    xml += `</urlset>`;

    res.header("Content-Type", "application/xml; charset=utf-8");
    res.header("Cache-Control", "public, max-age=3600, s-maxage=3600");
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
app.use("/api/recaptcha", recaptchaRoutes);
app.use("/api/videos", videoRoutes);

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    connectDB().catch((err) => {
      console.warn("Initial DB warmup attempt:", err.message);
    });
  });
}

export default app;

