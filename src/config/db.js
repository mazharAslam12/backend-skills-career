import mongoose from "mongoose";

let connectionPromise = null;
let listenersAttached = false;

const connectDB = async () => {
  // 1. Return immediately if already fully connected
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // 2. Return in-flight connection promise to prevent concurrent connection attempts (thundering herd)
  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("CRITICAL ERROR: MONGO_URI is undefined!");
    throw new Error("MONGO_URI environment variable is missing.");
  }

  const opts = {
    // Atlas replica set election grace period
    serverSelectionTimeoutMS: 30000,
    // Socket operation timeout
    socketTimeoutMS: 60000,
    // Heartbeat to detect failover
    heartbeatFrequencyMS: 10000,
    // Connection pool sizing
    maxPoolSize: 10,
    minPoolSize: 1,
    // Wait for connection from pool
    waitQueueTimeoutMS: 30000,
  };

  // 3. Attach listeners only once
  if (!listenersAttached) {
    mongoose.connection.on("disconnected", () => {
      console.warn("[MongoDB] Disconnected from Atlas — will auto-reconnect on next request.");
      connectionPromise = null;
    });

    mongoose.connection.on("error", (err) => {
      console.error("[MongoDB] Connection error:", err.message);
      connectionPromise = null;
    });

    mongoose.connection.on("reconnected", () => {
      console.log("[MongoDB] Reconnected 🔄");
    });

    listenersAttached = true;
  }

  // 4. Start connection and cache promise
  connectionPromise = mongoose.connect(uri, opts)
    .then((conn) => {
      console.log("MongoDB Connected 🔥");
      return conn;
    })
    .catch((error) => {
      console.error("MongoDB connection failed:", error.message);
      connectionPromise = null;
      throw error;
    })
    .finally(() => {
      // Clear in-flight promise once connection state has settled
      connectionPromise = null;
    });

  return connectionPromise;
};

export default connectDB;

