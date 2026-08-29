import { prisma } from '../config/database';
import { config } from '../config/env';
import jwt from 'jsonwebtoken';

export interface GoogleUserProfile {
  sub: string;
  name: string;
  email: string;
  picture?: string;
}

export class AuthService {
  /**
   * Exchange OAuth authorization code for Google access token
   */
  static async getGoogleToken(code: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleCallbackUrl,
      grant_type: 'authorization_code',
      code,
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Google OAuth Token Error]', errText);
      throw new Error('Failed to exchange Google authorization code');
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  /**
   * Fetch user profile from Google UserInfo endpoint
   */
  static async getGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Google OAuth UserInfo Error]', errText);
      throw new Error('Failed to fetch Google user profile');
    }

    return (await response.json()) as GoogleUserProfile;
  }

  /**
   * Find or create user in Neon PostgreSQL database
   */
  static async upsertUser(profile: GoogleUserProfile) {
    if (!profile.email) {
      throw new Error('Email is required from Google profile');
    }

    return prisma.user.upsert({
      where: { googleId: profile.sub },
      update: {
        name: profile.name,
        email: profile.email,
        avatar: profile.picture,
      },
      create: {
        googleId: profile.sub,
        name: profile.name,
        email: profile.email,
        avatar: profile.picture,
      },
    });
  }

  /**
   * Generate JWT token for the user session
   */
  static generateToken(userId: string): string {
    return jwt.sign({ userId }, config.jwtSecret, {
      expiresIn: '7d',
    });
  }
}
