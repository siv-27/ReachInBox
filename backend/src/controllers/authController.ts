import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { config } from '../config/env';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class AuthController {
  /**
   * Redirect user to Google OAuth Consent Screen
   */
  static googleLogin(req: Request, res: Response, next: NextFunction): void {
    try {
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
        response_type: 'code',
        client_id: config.googleClientId,
        redirect_uri: config.googleCallbackUrl,
        scope: 'profile email',
        prompt: 'select_account',
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
    try {
      const { code, error } = req.query;

      if (error) {
        res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(String(error))}`);
        return;
      }

      if (!code || typeof code !== 'string') {
        res.redirect(`${config.frontendUrl}/login?error=invalid_auth_code`);
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

      // Redirect to frontend dashboard
      res.redirect(`${config.frontendUrl}/dashboard`);
    } catch (error) {
      console.error('[Google Callback Exception]', error);
      res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
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
