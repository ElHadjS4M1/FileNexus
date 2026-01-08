import { Router } from 'express';
import { loginSchema, initSchema, totpSetupSchema } from '../schemas/auth.schema';
import {
  loginUser,
  initializeUser,
  setupTotp,
  getCookieOptions,
  getLogoutCookieOptions,
} from '../services/auth.service';
import { authenticate } from '../middleware/auth';
import { HttpError } from '../utils/httpError';

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const result = await loginUser(payload);

    if ('token' in result) {
      res.cookie('token', result.token, getCookieOptions());
      res.json({ user: result.user });
    } else {
      res.json(result);
    }
  } catch (error) {
    next(error);
  }
});

authRouter.post('/init', async (req, res, next) => {
  try {
    const payload = initSchema.parse(req.body);
    await initializeUser(payload);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

authRouter.post('/totp/setup', authenticate, async (req, res, next) => {
  try {
    if (!req.authUser) {
      throw new HttpError(401, 'Authentication required');
    }

    const payload = totpSetupSchema.parse(req.body ?? {});
    const result = await setupTotp(req.authUser.id, payload);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('token', getLogoutCookieOptions());
  res.status(204).send();
});

