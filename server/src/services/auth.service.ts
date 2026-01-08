import speakeasy from 'speakeasy';
import { createPublicKey, type JsonWebKey } from 'node:crypto';
import { appEnv } from '../config/env';
import { createInitToken, createJwt, verifyInitToken } from '../utils/jwt';
import { verifyPassword } from '../utils/password';
import {
    completeInitialization,
    enableTotp,
    findUserById,
    findUserByUsername,
    setTotpSecret,
} from './userService';
import { HttpError } from '../utils/httpError';
import { decryptWithKek, encryptWithKek } from '../utils/kek';
import type { z } from 'zod';
import type { loginSchema, initSchema, totpSetupSchema } from '../schemas/auth.schema';



/**
 * Descodifica una cadena base64 en un búfer.
 */
const b64 = (value: string): Buffer => Buffer.from(value, 'base64');

export const loginUser = async (payload: z.infer<typeof loginSchema>) => {
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
        return { requiresInit: true, initToken };
    }

    if (user.totpEnabled) {
        if (!payload.totp) {
            return { requiresTotp: true };
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

    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            totpEnabled: user.totpEnabled,
        },
    };
};

export const initializeUser = async (payload: z.infer<typeof initSchema>) => {
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
            publicKeyJwk: { jwk: publicKeyJwk as any, pem: payload.publicKeyPem },
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
};

export const setupTotp = async (userId: string, payload: z.infer<typeof totpSetupSchema>) => {
    const user = await findUserById(userId);
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
        return { totpEnabled: true };
    }

    const secret = speakeasy.generateSecret({
        length: 32,
        name: payload.label ?? `ProtectInfo (${user.username})`,
    });
    const wrapped = encryptWithKek(Buffer.from(secret.base32, 'utf8'));
    await setTotpSecret(user.id, wrapped, false);

    return {
        secretBase32: secret.base32,
        otpauthUrl: secret.otpauth_url,
    };
};

export const getCookieOptions = () => ({
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: appEnv.NODE_ENV !== 'development',
    domain: appEnv.COOKIE_DOMAIN,
    maxAge: 60 * 60 * 1000,
});

export const getLogoutCookieOptions = () => ({
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: appEnv.NODE_ENV !== 'development',
    domain: appEnv.COOKIE_DOMAIN,
});
