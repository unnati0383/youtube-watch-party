const mongoose = require("mongoose");

/**
 * Connect to MongoDB database
 * Reads MONGO_URI from environment variables, falling back to local MongoDB
 */
const connectDB = async () => {
  try {
    const mongoUri =
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/youtube_watch_party";

    const conn = await mongoose.connect(mongoUri);

    console.log(` MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(` Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
