import mongoose from "mongoose";

let isConnected = false;
let listenersAttached = false;
let keepAliveInterval = null;

const connectDB = async () => {
  // Already connected — fast path
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("CRITICAL ERROR: MONGO_URI is undefined!");
    throw new Error("MONGO_URI environment variable is missing.");
  }

  const opts = {
    // Don't buffer commands when disconnected — fail fast so UI can retry
    bufferCommands: false,
    // Atlas replica set election grace period
    serverSelectionTimeoutMS: 30000,
    // Socket operation timeout — keep generous for slow Atlas free tier
    socketTimeoutMS: 75000,
    // How often the driver pings Atlas to detect failover
    heartbeatFrequencyMS: 15000,
    // Connection pool — enough for concurrent requests
    maxPoolSize: 15,
    minPoolSize: 2,
    // Wait for pool slot before giving up
    waitQueueTimeoutMS: 30000,
    // Retryable writes — auto-retry transient write errors
    retryWrites: true,
    // Retryable reads — auto-retry transient read errors
    retryReads: true,
  };

  // Attach lifecycle listeners once
  if (!listenersAttached) {
    mongoose.connection.on("connected", () => {
      console.log("MongoDB Connected 🔥");
      isConnected = true;
      // Keep-alive ping every 30 seconds to prevent Atlas idle timeout
      if (!keepAliveInterval) {
        keepAliveInterval = setInterval(async () => {
          try {
            if (mongoose.connection.readyState === 1) {
              await mongoose.connection.db.admin().ping();
            }
          } catch (_) {}
        }, 30000);
      }
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("[MongoDB] Disconnected — will auto-reconnect on next request.");
      isConnected = false;
    });

    mongoose.connection.on("reconnected", () => {
      console.log("[MongoDB] Reconnected 🔄");
      isConnected = true;
    });

    mongoose.connection.on("error", (err) => {
      console.error("[MongoDB] Connection error:", err.message);
      isConnected = false;
    });

    mongoose.connection.on("close", () => {
      isConnected = false;
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    });

    listenersAttached = true;
  }

  try {
    await mongoose.connect(uri, opts);
    isConnected = true;
    return mongoose.connection;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    isConnected = false;
    throw error;
  }
};

export default connectDB;
