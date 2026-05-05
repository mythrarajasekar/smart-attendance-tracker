import winston from 'winston';

const { combine, timestamp, json, errors } = winston.format;

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    json()
  ),
  defaultMeta: { service: 'smart-attendance-tracker' },
  transports: [
    new winston.transports.Console(),
  ],
});

/**
 * Masks an email address for safe logging.
 * Example: john.doe@example.com → joh***@example.com
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, Math.min(3, local.length));
  return `${visible}***@${domain}`;
}
