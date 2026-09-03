import express from "express";

const router = express.Router();

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || "6LdSM6UtAAAAACXhmW9jqpK6IPBy_WWy2g7H8Cam";
const RECAPTCHA_PROJECT_ID  = process.env.RECAPTCHA_PROJECT_ID  || "skills-career-1788352061355";
const RECAPTCHA_SITE_KEY    = process.env.RECAPTCHA_SITE_KEY    || "6LdSM6UtAAAAAM3ihzDXciUzB_6zkF0ERCRmn7s9";

/**
 * POST /api/recaptcha/verify
 * Body: { token: string, action?: string }
 *
 * Uses Google reCAPTCHA v2 siteverify endpoint (compatible with reCAPTCHA Enterprise
 * v2 site keys). Returns { success, score, action, hostname, errors }.
 */
router.post("/verify", async (req, res) => {
  try {
    const { token, action = "submit" } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: "reCAPTCHA token is required" });
    }

    // Verify with Google reCAPTCHA siteverify API
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET_KEY}&response=${token}`;

    const googleResponse = await fetch(verifyUrl, { method: "POST" });
    const data = await googleResponse.json();

    // data.success === true means the token is valid
    // data.score is only present for reCAPTCHA v3 tokens; v2 tokens don't have a score
    // We simulate a score of 0.9 for successful v2 verification (checkbox confirmed)
    const result = {
      success: data.success === true,
      score: data.score !== undefined ? data.score : (data.success ? 0.9 : 0.0),
      action: data.action || action,
      hostname: data.hostname || "",
      challenge_ts: data.challenge_ts || "",
      errors: data["error-codes"] || [],
      projectId: RECAPTCHA_PROJECT_ID,
      siteKey: RECAPTCHA_SITE_KEY,
    };

    if (!result.success) {
      console.warn("[reCAPTCHA] Verification failed:", result.errors);
      return res.status(400).json({
        success: false,
        message: "reCAPTCHA verification failed. Please try again.",
        errors: result.errors,
      });
    }

    console.log(`[reCAPTCHA] ✅ Verified | score=${result.score} | action=${result.action} | host=${result.hostname}`);
    return res.json(result);
  } catch (error) {
    console.error("[reCAPTCHA] Server error:", error);
    return res.status(500).json({ success: false, message: "reCAPTCHA server error", error: error.message });
  }
});

/**
 * GET /api/recaptcha/config
 * Returns public reCAPTCHA config (site key + project ID) for the frontend.
 */
router.get("/config", (req, res) => {
  res.json({
    siteKey: RECAPTCHA_SITE_KEY,
    projectId: RECAPTCHA_PROJECT_ID,
  });
});

export default router;
