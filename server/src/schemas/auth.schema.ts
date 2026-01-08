import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(1),
  totp: z.string().length(6).regex(/^\d+$/).optional(),
});

export const initSchemaLegacy = z.object({
  initToken: z.string(),
  passwordNew: z.string().min(12),
  publicKeyJwk: z.record(z.any()),
  privEnc: z.string(),
  privNonce: z.string(),
  clientSalt: z.string(),
  kdfClient: z.record(z.any()),
});

export const initSchemaIvan = z.object({
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

export const initSchema = z.union([initSchemaLegacy, initSchemaIvan]);

export const totpSetupSchema = z.object({
  token: z.string().length(6).regex(/^\d+$/).optional(),
  label: z.string().optional(),
});
