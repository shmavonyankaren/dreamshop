import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "";

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

// Next development reloads can evaluate this module more than once while
// retaining Mongoose's default connection. Share pending work per instance.
const globalDB = globalThis as typeof globalThis & {
  dreamshopConnections?: WeakMap<typeof mongoose, Promise<typeof mongoose>>;
};
const pendingConnections = (globalDB.dreamshopConnections ??= new WeakMap());

export async function connectDB() {
  const existing = pendingConnections.get(mongoose);
  if (existing) return existing;
  if (mongoose.connection.readyState === 1) return mongoose;
  const pending = (async () => {
    if (mongoose.connection.readyState === 2) {
      // Calling connect() again while connecting may resolve before readiness.
      await mongoose.connection.asPromise();
    } else if (mongoose.connection.readyState === 3) {
      throw new Error("Database connection is closing. Please retry.");
    } else {
      await mongoose.connect(MONGODB_URI, {
        bufferCommands: false,
        // Bound request latency when Atlas is unreachable; these do not bypass
        // Atlas network access rules or certificate verification.
        serverSelectionTimeoutMS: 10_000,
        connectTimeoutMS: 10_000,
        // Keep the URI's database unless explicitly configured. Never assume
        // the unrelated "events" database from example connection snippets.
        ...(process.env.MONGODB_DB_NAME?.trim()
          ? { dbName: process.env.MONGODB_DB_NAME.trim() }
          : {}),
      });
      await mongoose.connection.asPromise();
    }
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Database connection is not ready. Please retry.");
    }
    return mongoose;
  })();
  pendingConnections.set(mongoose, pending);
  try {
    return await pending;
  } finally {
    if (pendingConnections.get(mongoose) === pending)
      pendingConnections.delete(mongoose);
  }
}
