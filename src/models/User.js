import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      default: "",
    },
    provider: {
      type: String,
      enum: ["local", "google", "github"],
      default: "local",
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    githubId: {
      type: String,
      unique: true,
      sparse: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    banner: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      default: "Full Stack Developer",
    },
    level: {
      type: Number,
      default: 1,
    },
    skills: {
      type: [String],
      default: [],
    },
    socials: {
      github: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      portfolio: { type: String, default: "" },
      twitter: { type: String, default: "" },
    },
    emailVerified: {
      type: Boolean,
      default: true,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    studentDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isOnline: {
      type: Boolean,
      default: true,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
      street: { type: String, default: "" },
      neighborhood: { type: String, default: "" },
      displayAddress: { type: String, default: "" },
      accuracy: { type: Number, default: null },
      allowed: { type: Boolean, default: false },
      updatedAt: { type: Date, default: Date.now },
    },
    currentPage: {
      type: String,
      default: "/",
    },
    deviceInfo: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    aiOnboarding: {
      completed: { type: Boolean, default: false },
      name: { type: String, default: "" },
      age: { type: Number, default: null },
      fatherName: { type: String, default: "" },
      goals: { type: String, default: "" },
      language: { type: String, default: "en" },
      completedAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export default User;
