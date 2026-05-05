"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../auth/auth.middleware");
const user_controller_1 = require("./user.controller");
const AppError_1 = require("../../shared/errors/AppError");
const router = (0, express_1.Router)();
// Multer: memory storage, 2 MB limit, images only
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new AppError_1.ValidationError('Only JPEG, PNG, and WebP images are allowed'));
        }
    },
});
// ─── Own profile routes (any authenticated role) ──────────────────────────────
router.get('/me', (0, auth_middleware_1.authenticate)(), user_controller_1.getMyProfileHandler);
router.put('/me', (0, auth_middleware_1.authenticate)(), user_controller_1.updateMyProfileHandler);
router.post('/me/photo', (0, auth_middleware_1.authenticate)(), upload.single('photo'), user_controller_1.uploadPhotoHandler);
// ─── Admin-only routes ────────────────────────────────────────────────────────
router.post('/', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['admin']), user_controller_1.createUserHandler);
router.get('/', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['admin']), user_controller_1.listUsersHandler);
router.get('/:id', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['admin']), user_controller_1.getUserByIdHandler);
router.put('/:id', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['admin']), user_controller_1.adminUpdateUserHandler);
router.delete('/:id', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['admin']), user_controller_1.deactivateUserHandler);
exports.default = router;
