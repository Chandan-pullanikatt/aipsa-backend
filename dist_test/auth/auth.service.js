"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
const prisma_service_1 = require("../prisma/prisma.service");
const mail_service_1 = require("../mail/mail.service");
let AuthService = class AuthService {
    prisma;
    jwt;
    config;
    mail;
    constructor(prisma, jwt, config, mail) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.mail = mail;
    }
    async sendOtp(dto) {
        const email = dto.email.trim().toLowerCase();
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await this.prisma.otpRequest.create({
            data: { email, code, expiresAt },
        });
        await this.mail.sendOtp(email, code);
        return { success: true };
    }
    async verifyOtp(dto, res) {
        const email = dto.email.trim().toLowerCase();
        const now = new Date();
        const mockOtp = this.config.get('MOCK_OTP');
        let otpRecord = null;
        if (mockOtp && dto.token === mockOtp) {
            console.log(`[AUTH] Mock OTP bypass used for ${email}`);
        }
        else {
            otpRecord = await this.prisma.otpRequest.findFirst({
                where: {
                    email,
                    code: dto.token,
                    usedAt: null,
                    expiresAt: { gt: now },
                },
                orderBy: { createdAt: 'desc' },
            });
            if (!otpRecord) {
                console.log(`[AUTH] Invalid OTP attempt for ${email}`);
                throw new common_1.BadRequestException('Invalid or expired OTP. Please request a new code.');
            }
            await this.prisma.otpRequest.update({
                where: { id: otpRecord.id },
                data: { usedAt: now },
            });
        }
        const profile = await this.prisma.profile.upsert({
            where: { email },
            create: { email, name: '' },
            update: {},
        });
        const accessToken = this.generateAccessToken(profile.id, profile.email);
        const refreshToken = await this.generateRefreshToken(profile.id);
        const refreshExpiryDays = parseInt(this.config.get('REFRESH_TOKEN_EXPIRES_IN_DAYS') ?? '7');
        const isProd = process.env.NODE_ENV === 'production';
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax',
            maxAge: refreshExpiryDays * 24 * 60 * 60 * 1000,
            path: '/',
        });
        return {
            accessToken,
            user: { id: profile.id, email: profile.email, name: profile.name },
        };
    }
    async refresh(refreshTokenCookie) {
        if (!refreshTokenCookie) {
            throw new common_1.UnauthorizedException('No refresh token provided');
        }
        const tokenHash = this.hashToken(refreshTokenCookie);
        const now = new Date();
        const stored = await this.prisma.refreshToken.findUnique({
            where: { tokenHash },
            include: { user: true },
        });
        if (!stored || stored.expiresAt < now) {
            throw new common_1.UnauthorizedException('Refresh token is invalid or expired');
        }
        return { accessToken: this.generateAccessToken(stored.user.id, stored.user.email) };
    }
    async logout(refreshTokenCookie, res) {
        if (refreshTokenCookie) {
            const tokenHash = this.hashToken(refreshTokenCookie);
            await this.prisma.refreshToken
                .delete({ where: { tokenHash } })
                .catch(() => { });
        }
        const isProd = process.env.NODE_ENV === 'production';
        res.clearCookie('refreshToken', {
            path: '/',
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax',
        });
        return { success: true };
    }
    generateAccessToken(userId, email) {
        const secret = this.config.get('JWT_SECRET');
        const expiresIn = this.config.get('JWT_EXPIRES_IN') ?? '15m';
        return this.jwt.sign({ sub: userId, email }, { secret, expiresIn: expiresIn });
    }
    async generateRefreshToken(userId) {
        const token = crypto.randomBytes(64).toString('hex');
        const tokenHash = this.hashToken(token);
        const days = parseInt(this.config.get('REFRESH_TOKEN_EXPIRES_IN_DAYS') ?? '7');
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        await this.prisma.refreshToken.create({
            data: { userId, tokenHash, expiresAt },
        });
        return token;
    }
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        mail_service_1.MailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map