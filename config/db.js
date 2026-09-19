const mongoose = require('mongoose');
const dns = require('dns');

let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    // If connection is already established and active, return cached connection
    if (cached.conn && mongoose.connection.readyState === 1) {
        return cached.conn;
    }

    const dbUri =
        process.env.MONGODB_URI ||
        'mongodb+srv://nexallianceit_db_user:NeX2026@cluster0.cwpvxt8.mongodb.net/NexAlliance';

    // Only apply DNS override in local development if needed, never in Vercel serverless
    if (!process.env.VERCEL && dbUri.startsWith('mongodb+srv://')) {
        try {
            dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
        } catch (e) {
            // Ignore
        }
    }

    if (!cached.promise) {
        const opts = {
            maxPoolSize: 10,
            minPoolSize: 1,
            serverSelectionTimeoutMS: 8000,
            socketTimeoutMS: 45000,
            bufferCommands: true // Allows Mongoose to buffer model calls until connection is ready
        };

        console.log('🔌 Connecting to MongoDB Atlas Cloud Database...');
        cached.promise = mongoose.connect(dbUri, opts).then((instance) => {
            console.log(`✅ MongoDB Connected: ${instance.connection.host} (Database: ${instance.connection.name})`);
            return instance;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (error) {
        cached.promise = null;
        console.error(`❌ MongoDB Atlas Connection Error: ${error.message}`);
        throw error;
    }

    return cached.conn;
};

/**
 * Express middleware to guarantee active DB connection before handling requests (crucial for Vercel serverless cold starts)
 */
const ensureDbConnected = async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error('Database connection middleware error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Database connection failed. Please verify MongoDB cluster status and environment variables.'
        });
    }
};

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.ensureDbConnected = ensureDbConnected;