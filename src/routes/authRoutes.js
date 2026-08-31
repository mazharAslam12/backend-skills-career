import express from "express";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: "User already exists. Please login." });
    }

    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=random`;
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      avatar,
      provider: "local",
      emailVerified: true,
      isApproved: false,
    });

    return res.status(201).json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to register user", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found. Please register first." });
    }

    if (user.provider === "google" && !user.password) {
      return res.status(400).json({ message: "This account uses Google sign-in. Continue with Google." });
    }

    if (user.role !== "admin" && user.email !== "mazhar@gmail.com" && !user.isApproved) {
      return res.status(403).json({ message: "Your account is pending admin approval. You cannot login until the administrator grants you access from the Admin Dashboard." });
    }

    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    return res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        banner: user.banner || "",
        phone: user.phone || "",
        role: user.role || "Full Stack Developer",
        level: user.level || 1,
        description: user.description || "",
        skills: user.skills || [],
        socials: user.socials || {},
        studentDetails: user.studentDetails,
        isApproved: user.isApproved,
        location: user.location,
        currentPage: user.currentPage,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Failed to login", error: error.message });
  }
});

router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: "GOOGLE_CLIENT_ID is not configured on backend" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.email) {
      return res.status(400).json({ message: "Invalid Google token payload" });
    }

    const normalizedEmail = payload.email.toLowerCase().trim();
    const isAdmin = normalizedEmail === "mazhar@gmail.com";
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      user = await User.create({
        name: payload.name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        avatar: payload.picture || "",
        provider: "google",
        googleId: payload.sub,
        emailVerified: payload.email_verified !== false,
        isApproved: isAdmin,
      });
    } else {
      user.name = payload.name || user.name;
      user.avatar = payload.picture || user.avatar;
      user.provider = "google";
      user.googleId = payload.sub || user.googleId;
      if (isAdmin) user.isApproved = true;
      if (payload.email_verified) user.emailVerified = true;
      await user.save();
    }

    if (!isAdmin && user.role !== "admin" && !user.isApproved) {
      return res.status(403).json({ message: "Your account is pending admin approval. You cannot login until the administrator grants you access from the Admin Dashboard." });
    }

    return res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        banner: user.banner || "",
        phone: user.phone || "",
        role: user.role || "Full Stack Developer",
        level: user.level || 1,
        description: user.description || "",
        skills: user.skills || [],
        socials: user.socials || {},
        studentDetails: user.studentDetails,
        isApproved: user.isApproved,
        location: user.location,
        currentPage: user.currentPage,
      },
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    return res.status(500).json({ message: "Google authentication failed", error: error.message });
  }
});

router.post("/github", async (req, res) => {
  try {
    const { githubId, name, email, avatar, username } = req.body;
    if (!email && !githubId) {
      return res.status(400).json({ message: "Email or githubId is required" });
    }

    const normalizedEmail = (email || `${username || githubId}@users.noreply.github.com`).toLowerCase().trim();
    const isAdmin = normalizedEmail === "mazhar@gmail.com";
    let user = await User.findOne({
      $or: [{ githubId: String(githubId) }, { email: normalizedEmail }],
    });

    if (!user) {
      user = await User.create({
        name: name || username || "GitHub Developer",
        email: normalizedEmail,
        avatar: avatar || `https://avatars.githubusercontent.com/u/${githubId}`,
        provider: "github",
        githubId: String(githubId),
        emailVerified: true,
        isApproved: isAdmin,
      });
    } else {
      user.name = name || user.name;
      user.avatar = avatar || user.avatar;
      user.provider = "github";
      user.githubId = String(githubId) || user.githubId;
      if (isAdmin) user.isApproved = true;
      await user.save();
    }

    if (!isAdmin && user.role !== "admin" && !user.isApproved) {
      return res.status(403).json({ message: "Your account is pending admin approval. You cannot login until the administrator grants you access from the Admin Dashboard." });
    }

    return res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        banner: user.banner || "",
        phone: user.phone || "",
        role: user.role || "Full Stack Developer",
        level: user.level || 1,
        description: user.description || "",
        skills: user.skills || [],
        socials: user.socials || {},
        studentDetails: user.studentDetails,
        isApproved: user.isApproved,
        location: user.location,
        currentPage: user.currentPage,
      },
    });
  } catch (error) {
    console.error("GitHub Auth Error:", error);
    return res.status(500).json({ message: "GitHub authentication failed", error: error.message });
  }
});

// GitHub OAuth Proxy: exchange code for token + user profile on backend (CORS-safe)
router.post("/github-oauth", async (req, res) => {
  try {
    const { code, client_id, client_secret } = req.body;
    if (!code) return res.status(400).json({ message: "Authorization code is required" });

    const cid = client_id || process.env.VITE_GITHUB_CLIENT_ID || "Ov23liDV03AD0rG4A1wy";
    const csec = client_secret || process.env.VITE_GITHUB_CLIENT_SECRET || "5e13ca4416f217448e32eb75bace019930a63370";

    // Step 1: exchange code for access_token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: cid, client_secret: csec, code }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error || !tokenData.access_token) {
      return res.status(400).json({ message: tokenData.error_description || "Failed to get GitHub access token. The code may have expired — please try again." });
    }

    const accessToken = tokenData.access_token;

    // Step 2: fetch GitHub user profile
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "skills-career-app", Accept: "application/vnd.github+json" },
    });
    const ghUser = await userRes.json();

    // Step 3: fetch primary email if profile email is private
    let email = ghUser.email;
    if (!email) {
      try {
        const emailsRes = await fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "skills-career-app", Accept: "application/vnd.github+json" },
        });
        const emails = await emailsRes.json();
        if (Array.isArray(emails)) {
          const primary = emails.find((e) => e.primary && e.verified);
          email = primary?.email || emails[0]?.email;
        }
      } catch (_) {}
    }
    if (!email) email = `${ghUser.login}@users.noreply.github.com`;

    // Step 4: upsert user in MongoDB
    const normalizedEmail = email.toLowerCase().trim();
    const isAdmin = normalizedEmail === "mazhar@gmail.com";
    let user = await User.findOne({ $or: [{ githubId: String(ghUser.id) }, { email: normalizedEmail }] });
    if (!user) {
      user = await User.create({
        name: ghUser.name || ghUser.login,
        email: normalizedEmail,
        avatar: ghUser.avatar_url,
        provider: "github",
        githubId: String(ghUser.id),
        emailVerified: true,
        isApproved: isAdmin,
      });
    } else {
      user.name = ghUser.name || ghUser.login || user.name;
      user.avatar = ghUser.avatar_url || user.avatar;
      user.provider = "github";
      user.githubId = String(ghUser.id);
      if (isAdmin) user.isApproved = true;
      await user.save();
    }

    if (!isAdmin && user.role !== "admin" && !user.isApproved) {
      return res.status(403).json({ message: "Your account is pending admin approval. You cannot login until the administrator grants you access from the Admin Dashboard." });
    }

    return res.json({
      access_token: accessToken,
      user: {
        githubId: String(ghUser.id),
        id: user._id.toString(),
        name: ghUser.name || ghUser.login,
        email: normalizedEmail,
        avatar: ghUser.avatar_url,
        username: ghUser.login,
        role: user.role || "Full Stack Developer",
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    console.error("GitHub OAuth Proxy Error:", error);
    return res.status(500).json({ message: "GitHub OAuth proxy failed", error: error.message });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    const now = Date.now();
    res.json(
      users.map((user) => {
        const lastActiveTime = user.lastActive ? new Date(user.lastActive).getTime() : 0;
        const isRealOnline = Boolean(user.isOnline && (now - lastActiveTime < 3 * 60 * 1000));
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          avatar: user.avatar || "",
          banner: user.banner || "",
          phone: user.phone || "",
          role: user.role || "Full Stack Developer",
          level: user.level || 1,
          description: user.description || "",
          skills: user.skills || [],
          socials: user.socials || {},
          isApproved: user.isApproved,
          studentDetails: user.studentDetails,
          isOnline: isRealOnline,
          lastActive: user.lastActive || user.updatedAt || user.createdAt,
          location: user.location || { lat: null, lng: null, city: "", country: "", allowed: false },
          currentPage: user.currentPage || "/",
          deviceInfo: user.deviceInfo || {},
          aiOnboarding: user.aiOnboarding || { completed: false },
          createdAt: user.createdAt,
        };
      }),
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
});

// Real-time Presence & Deep Geolocation Heartbeat
router.post("/presence/heartbeat", async (req, res) => {
  try {
    const { userId, isOnline = true, location, lat, lng, city, state, country, street, neighborhood, displayAddress, accuracy, allowed, currentPage, deviceInfo } = req.body;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      const updateData = {
        isOnline: Boolean(isOnline),
        lastActive: new Date(),
      };
      if (currentPage) updateData.currentPage = currentPage;
      if (deviceInfo) updateData.deviceInfo = deviceInfo;
      if (allowed === false) {
        updateData["location.allowed"] = false;
      } else if (location || lat !== undefined) {
        updateData.location = {
          lat: lat !== undefined ? lat : location?.lat,
          lng: lng !== undefined ? lng : location?.lng,
          city: city || location?.city || "",
          state: state || location?.state || "",
          country: country || location?.country || "",
          street: street || location?.street || "",
          neighborhood: neighborhood || location?.neighborhood || "",
          displayAddress: displayAddress || location?.displayAddress || "",
          accuracy: accuracy !== undefined ? accuracy : location?.accuracy,
          allowed: allowed !== undefined ? allowed : (location?.allowed !== false),
          updatedAt: new Date(),
        };
      }
      await User.findByIdAndUpdate(userId, updateData);
    }
    return res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (e) {
    return res.json({ success: false });
  }
});

// AI Underage Auto-Unapproval & Admin Notification
router.post("/onboarding/age-verification-alert", async (req, res) => {
  try {
    const { userId, studentName, studentEmail, studentAge, reason } = req.body;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      await User.findByIdAndUpdate(userId, {
        isApproved: false,
        "aiOnboarding.completed": true,
        "aiOnboarding.age": Number(studentAge),
        "aiOnboarding.completedAt": new Date(),
      });

      // Insert message for Admin
      const CollectionItem = mongoose.model("CollectionItem");
      if (CollectionItem) {
        await CollectionItem.create({
          collectionName: "message",
          data: {
            subject: `⚠️ Underage Student Policy Alert: ${studentName || 'Student'} (<18 yrs)`,
            content: `AI Onboarding Interview Notice: Student ${studentName} (${studentEmail || 'No Email'}) stated age is ${studentAge} years old (<18 years policy minimum). Account approval has been automatically revoked pending admin review. Reason: ${reason || 'Under 18 Admission Policy Requirement'}`,
            from: "Mazhar DevX AI Safety Sentinel",
            senderRole: "AI Assistant",
            createdAt: new Date().toISOString(),
          },
          assignedTo: [],
        });
      }
    }
    return res.json({ success: true, message: "Underage policy alert dispatched and student unapproved." });
  } catch (e) {
    console.error("Age alert error:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const { isApproved, role, phone, studentDetails, name, email, level, isOnline, lastActive, location, currentPage, deviceInfo, aiOnboarding } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (isApproved !== undefined) user.isApproved = isApproved;
    if (role !== undefined) user.role = role;
    if (phone !== undefined) user.phone = phone;
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email.toLowerCase().trim();
    if (studentDetails !== undefined) user.studentDetails = studentDetails;
    if (level !== undefined) user.level = level;
    if (isOnline !== undefined) user.isOnline = isOnline;
    if (lastActive !== undefined) user.lastActive = lastActive;
    if (location !== undefined) user.location = location;
    if (currentPage !== undefined) user.currentPage = currentPage;
    if (deviceInfo !== undefined) user.deviceInfo = deviceInfo;
    if (aiOnboarding !== undefined) user.aiOnboarding = { ...user.aiOnboarding, ...aiOnboarding };

    await user.save();
    res.json({ message: "User updated successfully", user });
  } catch (error) {
    res.status(500).json({ message: "Failed to update user", error: error.message });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user", error: error.message });
  }
});


// Student self-update profile
router.put("/profile/:id", async (req, res) => {
  try {
    const { name, avatar, banner, phone, role, level, description, skills, socials, oldPassword, newPassword } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Password change verification
    if (newPassword) {
      if (user.password && user.password !== oldPassword) {
        return res.status(400).json({ message: "Old password does not match. Please enter your correct current password." });
      }
      user.password = newPassword;
    }

    if (name !== undefined) user.name = name;
    if (avatar !== undefined) user.avatar = avatar;
    if (banner !== undefined) user.banner = banner;
    if (phone !== undefined) user.phone = phone;
    if (role !== undefined) user.role = role;
    if (level !== undefined) user.level = level;
    if (description !== undefined) user.description = description;
    if (skills !== undefined) user.skills = skills;
    if (socials !== undefined) user.socials = socials;

    await user.save();
    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        banner: user.banner,
        phone: user.phone,
        role: user.role,
        level: user.level || 1,
        description: user.description,
        skills: user.skills,
        socials: user.socials,
        studentDetails: user.studentDetails,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
});

// Public profile fetching (for SEO and sharing)
router.get("/public-users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return safe public profile data for Google Search Console indexing
    res.json({
      id: user._id.toString(),
      name: user.name,
      avatar: user.avatar,
      banner: user.banner,
      phone: user.phone,
      role: user.role || "Full Stack Developer",
      description: user.description || "A student developer at Skills Career.",
      skills: user.skills || [],
      socials: user.socials || {},
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch public profile", error: error.message });
  }
});

export default router;
