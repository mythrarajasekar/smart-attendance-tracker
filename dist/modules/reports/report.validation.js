"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportQuerySchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.reportQuerySchema = joi_1.default.object({
    month: joi_1.default.number().integer().min(1).max(12).required(),
    year: joi_1.default.number().integer().min(2000).max(2100).required(),
    format: joi_1.default.string().valid('pdf', 'excel', 'csv').default('pdf'),
    threshold: joi_1.default.number().min(1).max(100).default(75),
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(1000).default(100),
});
