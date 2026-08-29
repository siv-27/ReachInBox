import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { config } from '../config/env';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

/**
 * Helper to resolve frontend base URL dynamically from request parameters or environment settings
 */
function resolveFrontendBaseUrl(req: Request): string {
  // 1. Check state query parameter
  if (req.query.state) {
    try {
      const decodedState = JSON.parse(Buffer.from(String(req.query.state), 'base64url').toString('utf8'));
      if (decodedState.origin && (decodedState.origin.startsWith('http://') || decodedState.origin.startsWith('https://'))) {
        return decodedState.origin.replace(/\/$/, '');
      }
    } catch (err) {
      // Ignore parse error
    }
  }

  // 2. Check explicitly configured FRONTEND_URL env variable if present and not localhost fallback in production
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL !== 'http://localhost:5173') {
    return process.env.FRONTEND_URL.replace(/\/$/, '');
  }

  // 3. Check Referer or Origin headers
  const referer = req.headers.referer;
  if (referer) {
    try {
      const url = new URL(referer);
      return url.origin;
    } catch (e) {}
  }

  const origin = req.headers.origin;
  if (origin && origin !== 'null') {
    return origin.replace(/\/$/, '');
  }

  // 4. Default to config.frontendUrl or localhost
  return (config.frontendUrl || 'http://localhost:5173').replace(/\/$/, '');
}

export class AuthController {
  /**
   * Redirect user to Google OAuth Consent Screen
   */
  static googleLogin(req: Request, res: Response, next: NextFunction): void {
    try {
      const redirectOrigin = String(req.query.redirect_origin || req.headers.referer || '').replace(/\/$/, '');
      const state = redirectOrigin ? Buffer.from(JSON.stringify({ origin: redirectOrigin })).toString('base64url') : '';

      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
        response_type: 'code',
        client_id: config.googleClientId,
        redirect_uri: config.googleCallbackUrl,
        scope: 'profile email',
        prompt: 'select_account',
        ...(state ? { state } : {}),
      }).toString();

      res.redirect(googleAuthUrl);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process callback code returned by Google OAuth
   */
  static async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    const frontendBaseUrl = resolveFrontendBaseUrl(req);

    try {
      const { code, error } = req.query;

      if (error) {
        res.redirect(`${frontendBaseUrl}/login?error=${encodeURIComponent(String(error))}`);
        return;
      }

      if (!code || typeof code !== 'string') {
        res.redirect(`${frontendBaseUrl}/login?error=invalid_auth_code`);
        return;
      }

      // Exchange code for Google token
      const accessToken = await AuthService.getGoogleToken(code);

      // Fetch user profile information using access token
      const profile = await AuthService.getGoogleUserProfile(accessToken);

      // Upsert User in database
      const user = await AuthService.upsertUser(profile);

      // Generate JWT session token
      const token = AuthService.generateToken(user.id);

      // Store token in HTTP-only Cookie
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      console.log(`[Google Callback] Authentication successful for ${user.email}. Redirecting to ${frontendBaseUrl}/dashboard`);
      res.redirect(`${frontendBaseUrl}/dashboard`);
    } catch (error) {
      console.error('[Google Callback Exception]', error);
      res.redirect(`${frontendBaseUrl}/login?error=auth_failed`);
    }
  }

  /**
   * Return authenticated user info
   */
  static me(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Not authenticated' });
        return;
      }

      res.json({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user by invalidating authorization token
   */
  static logout(req: Request, res: Response, next: NextFunction): void {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      res.clearCookie('token', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
      });
      res.json({ status: 'ok', message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }
}
