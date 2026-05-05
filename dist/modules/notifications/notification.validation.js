"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationQuerySchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.notificationQuerySchema = joi_1.default.object({
    read: joi_1.default.boolean().optional(),
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(20),
});
