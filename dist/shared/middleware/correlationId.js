"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationIdMiddleware = void 0;
const uuid_1 = require("uuid");
/**
 * Injects a correlation ID into every request.
 * Uses the incoming x-correlation-id header if present, otherwise generates a UUID v4.
 * Attaches to req.correlationId and echoes back in the response header.
 */
function correlationIdMiddleware(req, res, next) {
    const correlationId = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
}
exports.correlationIdMiddleware = correlationIdMiddleware;
