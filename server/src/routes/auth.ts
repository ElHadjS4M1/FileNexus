import { Router } from 'express';
import { z } from 'zod';
import speakeasy from 'speakeasy';
import { createPublicKey } from 'node:crypto';
import { appEnv } from '../config/env';
import { createInitToken, createJwt, verifyInitToken } from '../utils/jwt';
import { verifyPassword } from '../utils/password';
import {
  completeInitialization,
  enableTotp,
  findUserById,
  findUserByUsername,
  setTotpSecret,
} from '../services/userService';
import { HttpError } from '../utils/httpError';
import { decryptWithKek, encryptWithKek } from '../utils/kek';
import { authenticate } from '../middleware/auth';

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(1),
  totp: z.string().length(6).regex(/^\d+$/).optional(),
});

const initSchemaLegacy = z.object({
  initToken: z.string(),
  passwordNew: z.string().min(12),
  publicKeyJwk: z.record(z.any()),
  privEnc: z.string(),
  privNonce: z.string(),
  clientSalt: z.string(),
  kdfClient: z.record(z.any()),
});

const initSchemaIvan = z.object({
  initToken: z.string(),
  passwordNew: z.string().min(12),
  publicKeyPem: z.string(),
  encryptedPrivateKey: z.string(),
  encryptionMetadata: z.object({
    iv: z.string(),
    hkdfSalt: z.string(),
    hkdfInfo: z.string().optional(),
  }),
});

const initSchema = z.union([initSchemaLegacy, initSchemaIvan]);

const totpSetupSchema = z.object({
  token: z.string().length(6).regex(/^\d+$/).optional(),
  label: z.string().optional(),
});

const AUTH_COOKIE = 'token';

export const authRouter = Router();

/**
 * Decodes a base64 string into a Buffer.
 * @param {string} value - Base64 encoded payload.
 * @returns {Buffer} Decoded buffer.
 */
const b64 = (value: string): Buffer => Buffer.from(value, 'base64');

authRouter.post('/login', async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const user = await findUserByUsername(payload.username);

    if (!user) {
      throw new HttpError(401, 'Invalid credentials');
    }

    const passwordValid = await verifyPassword(payload.password, user.pwdHash);
    if (!passwordValid) {
      throw new HttpError(401, 'Invalid credentials');
    }

    if (user.status === 'pending_init') {
      const initToken = createInitToken(user.id);
      res.json({ requiresInit: true, initToken });
      return;
    }

    if (user.totpEnabled) {
      if (!payload.totp) {
        res.json({ requiresTotp: true });
        return;
      }
      if (!user.totpSecretEnc) {
        throw new HttpError(500, 'TOTP secret missing');
      }
      const secret = decryptWithKek(user.totpSecretEnc).toString('utf8');
      const verified = speakeasy.totp.verify({
        secret,
        token: payload.totp,
        encoding: 'base32',
        window: 1,
      });
      if (!verified) {
        throw new HttpError(401, 'Invalid TOTP code');
      }
    }

    const token = createJwt({ id: user.id, role: user.role });
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: appEnv.NODE_ENV !== 'development',
      domain: appEnv.COOKIE_DOMAIN,
      maxAge: 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        totpEnabled: user.totpEnabled,
      },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/init', async (req, res, next) => {
  try {
    const payload = initSchema.parse(req.body);
    const claims = verifyInitToken(payload.initToken);

    if (claims.scope !== 'init') {
      throw new HttpError(400, 'Invalid init token');
    }

    const user = await findUserById(claims.sub);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    if (user.status !== 'pending_init') {
      throw new HttpError(409, 'Account already initialized');
    }

    if ('publicKeyJwk' in payload) {
      await completeInitialization(user.id, {
        passwordNew: payload.passwordNew,
        publicKeyJwk: payload.publicKeyJwk,
        privEnc: b64(payload.privEnc),
        privNonce: b64(payload.privNonce),
        clientSalt: b64(payload.clientSalt),
        kdfClient: payload.kdfClient,
      });
    } else {
      let publicKeyJwk: JsonWebKey;
      try {
        publicKeyJwk = createPublicKey(payload.publicKeyPem).export({
          format: 'jwk',
        }) as JsonWebKey;
      } catch (error) {
        throw new HttpError(400, 'Invalid public key provided', { cause: error });
      }
      await completeInitialization(user.id, {
        passwordNew: payload.passwordNew,
        publicKeyJwk: { jwk: publicKeyJwk, pem: payload.publicKeyPem },
        publicKeyPem: payload.publicKeyPem,
        privEnc: b64(payload.encryptedPrivateKey),
        privNonce: b64(payload.encryptionMetadata.iv),
        clientSalt: b64(payload.encryptionMetadata.hkdfSalt),
        kdfClient: {
          alg: 'HKDF-SHA256',
          info: payload.encryptionMetadata.hkdfInfo ?? 'private-key-encryption',
          source: 'client',
        },
      });
    }

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
    const user = await findUserById(req.authUser.id);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    if (payload.token) {
      if (!user.totpSecretEnc) {
        throw new HttpError(400, 'Secret not generated');
      }
      const currentSecret = decryptWithKek(user.totpSecretEnc).toString('utf8');
      const valid = speakeasy.totp.verify({
        secret: currentSecret,
        token: payload.token,
        encoding: 'base32',
        window: 1,
      });
      if (!valid) {
        throw new HttpError(400, 'Invalid TOTP code');
      }
      await enableTotp(user.id);
      res.json({ totpEnabled: true });
      return;
    }

    const secret = speakeasy.generateSecret({
      length: 32,
      name: payload.label ?? `ProtectInfo (${user.username})`,
    });
    const wrapped = encryptWithKek(Buffer.from(secret.base32, 'utf8'));
    await setTotpSecret(user.id, wrapped, false);

    res.json({
      secretBase32: secret.base32,
      otpauthUrl: secret.otpauth_url,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    secure: appEnv.NODE_ENV !== 'development',
    domain: appEnv.COOKIE_DOMAIN,
  });
  res.status(204).send();
});
