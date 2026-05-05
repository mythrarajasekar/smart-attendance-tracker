"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("express-async-errors");
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const mongoose_1 = __importDefault(require("mongoose"));
const correlationId_1 = require("./shared/middleware/correlationId");
const errorHandler_1 = require("./shared/middleware/errorHandler");
const logger_1 = require("./shared/utils/logger");
const redisClient_1 = __importDefault(require("./shared/utils/redisClient"));
// Route imports
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const user_routes_1 = __importDefault(require("./modules/users/user.routes"));
const subject_routes_1 = __importDefault(require("./modules/subjects/subject.routes"));
const attendance_routes_1 = __importDefault(require("./modules/attendance/attendance.routes"));
const report_routes_1 = __importDefault(require("./modules/reports/report.routes"));
const notification_routes_1 = __importDefault(require("./modules/notifications/notification.routes"));
// Background jobs
const attendance_jobs_1 = require("./modules/attendance/attendance.jobs");
const report_jobs_1 = require("./modules/reports/report.jobs");
const notification_jobs_1 = require("./modules/notifications/notification.jobs");
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3000', 10);
// ─── Security middleware ──────────────────────────────────────────────────────
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
        },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
}));
// CORS (SECURITY-08)
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3001').split(',');
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
// Global rate limiter (SECURITY-11) — uses Redis store in production, memory store in dev
const redisEnabled = process.env.REDIS_ENABLED !== 'false';
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    ...(redisEnabled ? {
        store: (() => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const RedisStore = require('rate-limit-redis');
            return new RedisStore({ sendCommand: (...args) => redisClient_1.default.call(...args) });
        })(),
    } : {}),
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
});
app.use(globalLimiter);
// ─── Request middleware ───────────────────────────────────────────────────────
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use(correlationId_1.correlationIdMiddleware);
// ─── Health check (no auth, no rate limit) ───────────────────────────────────
app.get('/health', async (_req, res) => {
    const mongoState = mongoose_1.default.connection.readyState; // 1 = connected
    const redisState = redisClient_1.default.status; // 'ready' = connected
    const healthy = mongoState === 1 && redisState === 'ready';
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
            mongodb: mongoState === 1 ? 'connected' : 'disconnected',
            redis: redisState === 'ready' ? 'connected' : redisState,
        },
        version: process.env.npm_package_version || '1.0.0',
    });
});
// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/users', user_routes_1.default);
app.use('/api/v1/subjects', subject_routes_1.default);
app.use('/api/v1/attendance', attendance_routes_1.default);
app.use('/api/v1/reports', report_routes_1.default);
app.use('/api/v1/notifications', notification_routes_1.default);
// ─── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler_1.globalErrorHandler);
// ─── Database connection ──────────────────────────────────────────────────────
async function connectDatabase() {
    const uri = process.env.MONGODB_URI;
    if (!uri)
        throw new Error('MONGODB_URI environment variable is not set');
    await mongoose_1.default.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    });
    logger_1.logger.info('MongoDB connected', { uri: uri.replace(/\/\/.*@/, '//***@') });
}
// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
    // Validate required environment variables
    const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'MONGODB_URI'];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
        logger_1.logger.error('Missing required environment variables', { missing });
        process.exit(1);
    }
    await connectDatabase();
    const server = app.listen(PORT, () => {
        logger_1.logger.info('Server started', { port: PORT, env: process.env.NODE_ENV });
    });
    // Start background jobs
    if (process.env.NODE_ENV !== 'test') {
        (0, attendance_jobs_1.startAttendanceRecalculationJob)();
        (0, report_jobs_1.startReportCacheCleanupJob)();
        (0, notification_jobs_1.startWeeklyReminderJob)();
    }
    // Graceful shutdown
    const shutdown = async (signal) => {
        logger_1.logger.info(`Received ${signal}, shutting down gracefully`);
        server.close(async () => {
            await mongoose_1.default.connection.close();
            await redisClient_1.default.quit();
            logger_1.logger.info('Server shut down cleanly');
            process.exit(0);
        });
        // Force exit after 30 seconds
        setTimeout(() => process.exit(1), 30000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
start().catch(err => {
    logger_1.logger.error('Failed to start server', { err });
    process.exit(1);
});
exports.default = app;
