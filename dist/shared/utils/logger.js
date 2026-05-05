"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskEmail = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const { combine, timestamp, json, errors } = winston_1.default.format;
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(errors({ stack: true }), timestamp(), json()),
    defaultMeta: { service: 'smart-attendance-tracker' },
    transports: [
        new winston_1.default.transports.Console(),
    ],
});
/**
 * Masks an email address for safe logging.
 * Example: john.doe@example.com → joh***@example.com
 */
function maskEmail(email) {
    const [local, domain] = email.split('@');
    if (!domain)
        return '***';
    const visible = local.slice(0, Math.min(3, local.length));
    return `${visible}***@${domain}`;
}
exports.maskEmail = maskEmail;
