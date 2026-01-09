// src/utils/fileCrypto.js
export function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\r|\n/g, "")
    .trim();
  return base64ToArrayBuffer(b64);
}

export async function generateAesKey() {
  return await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function exportAesKeyRawBase64(aesKey) {
  const raw = await window.crypto.subtle.exportKey("raw", aesKey);
  return arrayBufferToBase64(raw);
}

export async function importAesKeyFromRawBase64(base64) {
  const raw = base64ToArrayBuffer(base64);
  return await window.crypto.subtle.importKey("raw", raw, "AES-GCM", true, ["encrypt", "decrypt"]);
}

export async function encryptFileWithAesGcm(fileOrArrayBuffer) {
  let arrayBuffer;
  let filename = "file";
  let mimeType = "application/octet-stream";
  if (fileOrArrayBuffer instanceof File) {
    filename = fileOrArrayBuffer.name || filename;
    mimeType = fileOrArrayBuffer.type || mimeType;
    arrayBuffer = await fileOrArrayBuffer.arrayBuffer();
  } else if (fileOrArrayBuffer instanceof ArrayBuffer) {
    arrayBuffer = fileOrArrayBuffer;
  } else if (fileOrArrayBuffer instanceof Uint8Array) {
    arrayBuffer = fileOrArrayBuffer.buffer;
  } else {
    throw new Error("encryptFileWithAesGcm expects a File or ArrayBuffer or Uint8Array");
  }

  const aesKey = await generateAesKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, arrayBuffer);

  return {
    aesKey,
    ciphertext: new Uint8Array(ciphertext),
    iv,
    filename,
    mimeType,
  };
}

export async function decryptFileWithAesGcm(ciphertextBase64, ivBase64, aesKey) {
  const ctBuf = base64ToArrayBuffer(ciphertextBase64);
  const ivBuf = base64ToArrayBuffer(ivBase64);
  const iv = new Uint8Array(ivBuf);
  const plain = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ctBuf);
  return plain;
}

export async function importPublicKeyFromPem(pem) {
  const spkiBuf = pemToArrayBuffer(pem);
  return await window.crypto.subtle.importKey("spki", spkiBuf, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
}

export async function importPublicKeyFromJwk(jwk) {
  return await window.crypto.subtle.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
}

export async function importPrivateKeyFromPkcs8Base64(pkcs8Base64) {
  const buf = base64ToArrayBuffer(pkcs8Base64);
  return await window.crypto.subtle.importKey("pkcs8", buf, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]);
}

export async function encryptAesKeyWithPublicKey(aesRawBase64, publicKeyCryptoKey) {
  const raw = base64ToArrayBuffer(aesRawBase64);
  const encrypted = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKeyCryptoKey, raw);
  return arrayBufferToBase64(encrypted);
}

export async function decryptAesKeyWithPrivateKey(encryptedKeyBase64, privateKeyCryptoKey) {
  const encBuf = base64ToArrayBuffer(encryptedKeyBase64);
  const decrypted = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKeyCryptoKey, encBuf);
  return arrayBufferToBase64(decrypted);
}


export async function sha256Base64(buffer) {
  const hash = await window.crypto.subtle.digest("SHA-256", buffer);
  return arrayBufferToBase64(hash);
}

// Import private key for signing (RSA-PSS)
export async function importPrivateKeyForSigning(pkcs8Base64) {
  const buf = base64ToArrayBuffer(pkcs8Base64);
  return await window.crypto.subtle.importKey(
    "pkcs8",
    buf,
    { name: "RSA-PSS", hash: "SHA-256" },
    true,
    ["sign"]
  );
}

// Import public key for verification (RSA-PSS) from JWK
export async function importPublicKeyForVerification(jwk) {
  // Modify JWK for RSA-PSS algorithm
  const pssJwk = { ...jwk, alg: "PS256" };
  return await window.crypto.subtle.importKey(
    "jwk",
    pssJwk,
    { name: "RSA-PSS", hash: "SHA-256" },
    true,
    ["verify"]
  );
}

// Sign a hash with private key
export async function signHash(hashBase64, signingKey) {
  const hashBuf = base64ToArrayBuffer(hashBase64);
  const signature = await window.crypto.subtle.sign(
    { name: "RSA-PSS", saltLength: 32 },
    signingKey,
    hashBuf
  );
  return arrayBufferToBase64(signature);
}

// Verify signature
export async function verifySignature(hashBase64, signatureBase64, verifyKey) {
  const hashBuf = base64ToArrayBuffer(hashBase64);
  const sigBuf = base64ToArrayBuffer(signatureBase64);
  return await window.crypto.subtle.verify(
    { name: "RSA-PSS", saltLength: 32 },
    verifyKey,
    sigBuf,
    hashBuf
  );
}
