import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials or account deactivated.');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role.name,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'agencyos-super-secret-key-2026',
      expiresIn: '15m',
    });

    // Create a new refresh token (valid for 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshTokenString = this.jwtService.sign(
      { sub: user.id },
      {
        secret: process.env.JWT_REFRESH_SECRET || 'agencyos-refresh-token-secret-2026',
        expiresIn: '7d',
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        token: refreshTokenString,
        userId: user.id,
        expiresAt,
      },
    });

    const permissions = user.role.permissions.map((rp) => rp.permission.name);

    return {
      accessToken,
      refreshToken: refreshTokenString,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        permissions,
      },
    };
  }

  async refreshTokens(refreshTokenStr: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshTokenStr, {
        secret: process.env.JWT_REFRESH_SECRET || 'agencyos-refresh-token-secret-2026',
      });
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const dbToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshTokenStr },
      include: {
        user: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!dbToken || dbToken.revokedAt || new Date() > dbToken.expiresAt) {
      if (dbToken && !dbToken.revokedAt) {
        // Reuse detection: If token is expired or reused, clean up all user refresh tokens for safety
        await this.prisma.refreshToken.deleteMany({
          where: { userId: dbToken.userId },
        });
      }
      throw new UnauthorizedException('Refresh token is expired, revoked, or invalid.');
    }

    // Revoke the old refresh token (rotation)
    await this.prisma.refreshToken.delete({
      where: { id: dbToken.id },
    });

    // Issue new access and refresh tokens
    const user = dbToken.user;
    const newPayload = {
      email: user.email,
      sub: user.id,
      role: user.role.name,
    };

    const newAccessToken = this.jwtService.sign(newPayload, {
      secret: process.env.JWT_SECRET || 'agencyos-super-secret-key-2026',
      expiresIn: '15m',
    });

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    const newRefreshTokenString = this.jwtService.sign(
      { sub: user.id },
      {
        secret: process.env.JWT_REFRESH_SECRET || 'agencyos-refresh-token-secret-2026',
        expiresIn: '7d',
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        token: newRefreshTokenString,
        userId: user.id,
        expiresAt: newExpiresAt,
      },
    });

    const permissions = user.role.permissions.map((rp) => rp.permission.name);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshTokenString,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        permissions,
      },
    };
  }

  async logout(refreshTokenStr: string) {
    try {
      await this.prisma.refreshToken.delete({
        where: { token: refreshTokenStr },
      });
      return { success: true, message: 'Logged out successfully.' };
    } catch (e) {
      throw new BadRequestException('Invalid session or token already cleared.');
    }
  }
}
