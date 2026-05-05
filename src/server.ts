import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { correlationIdMiddleware } from './shared/middleware/correlationId';
import { globalErrorHandler } from './shared/middleware/errorHandler';
import { logger } from './shared/utils/logger';
import redisClient from './shared/utils/redisClient';

// Route imports
import authRouter from './modules/auth/auth.routes';
import userRouter from './modules/users/user.routes';
import subjectRouter from './modules/subjects/subject.routes';
import attendanceRouter from './modules/attendance/attendance.routes';
import reportRouter from './modules/reports/report.routes';
import notificationRouter from './modules/notifications/notification.routes';

// Background jobs
import { startAttendanceRecalculationJob } from './modules/attendance/attendance.jobs';
import { startReportCacheCleanupJob } from './modules/reports/report.jobs';
import { startWeeklyReminderJob } from './modules/notifications/notification.jobs';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({
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
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Global rate limiter (SECURITY-11) — uses Redis store in production, memory store in dev
const redisEnabled = process.env.REDIS_ENABLED !== 'false';
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisEnabled ? {
    store: (() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RedisStore = require('rate-limit-redis');
      return new RedisStore({ sendCommand: (...args: string[]) => redisClient.call(...args) });
    })(),
  } : {}),
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
});
app.use(globalLimiter);

// ─── Request middleware ───────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(correlationIdMiddleware);

// ─── Health check (no auth, no rate limit) ───────────────────────────────────
app.get('/health', async (_req, res) => {
  const mongoState = mongoose.connection.readyState; // 1 = connected
  const redisState = redisClient.status; // 'ready' = connected

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
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/subjects', subjectRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/reports', reportRouter);
app.use('/api/v1/notifications', notificationRouter);

// ─── Global error handler (must be last) ─────────────────────────────────────
app.use(globalErrorHandler);

// ─── Database connection ──────────────────────────────────────────────────────
async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  logger.info('MongoDB connected', { uri: uri.replace(/\/\/.*@/, '//***@') });
}

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  // Validate required environment variables
  const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'MONGODB_URI'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    logger.error('Missing required environment variables', { missing });
    process.exit(1);
  }

  await connectDatabase();

  const server = app.listen(PORT, () => {
    logger.info('Server started', { port: PORT, env: process.env.NODE_ENV });
  });

  // Start background jobs
  if (process.env.NODE_ENV !== 'test') {
    startAttendanceRecalculationJob();
    startReportCacheCleanupJob();
    startWeeklyReminderJob();
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    server.close(async () => {
      await mongoose.connection.close();
      await redisClient.quit();
      logger.info('Server shut down cleanly');
      process.exit(0);
    });
    // Force exit after 30 seconds
    setTimeout(() => process.exit(1), 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch(err => {
  logger.error('Failed to start server', { err });
  process.exit(1);
});

export default app;
