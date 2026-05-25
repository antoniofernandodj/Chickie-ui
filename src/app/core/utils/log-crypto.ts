/**
 * Criptografia híbrida para payload de logs.
 *
 * Estratégia:
 *  - AES-GCM 256-bit para encriptar o payload (eficiente para dados variáveis)
 *  - RSA-OAEP 2048-bit para encriptar a chave AES efêmera (só o server decripta)
 *
 * Isso garante que quem inspecionar a aba de rede veja apenas blobs base64
 * e não consiga decriptar mesmo tendo acesso ao bundle JS (a private key
 * nunca sai do servidor).
 */

export interface EncryptedLogPayload {
  encrypted: true;
  keyId:         string; // fingerprint da chave usada (12 hex chars) — detecta rotação
  encryptedKey:  string; // base64 — chave AES encriptada com RSA public key
  encryptedData: string; // base64 — payload AES-GCM (dados + auth tag 16 bytes no final)
  iv:            string; // base64 — IV aleatório de 12 bytes para AES-GCM
}

// Cache da CryptoKey para não reimportar a cada log
let _cachedPublicKey: CryptoKey | null = null;
let _cachedPem: string | null = null;

/** Descarta o cache da CryptoKey (chamado quando o servidor rotaciona as chaves). */
export function clearPublicKeyCache(): void {
  _cachedPublicKey = null;
  _cachedPem       = null;
}

async function importPublicKey(pem: string): Promise<CryptoKey> {
  if (_cachedPublicKey && _cachedPem === pem) return _cachedPublicKey;

  const pemContents = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\n/g, '')
    .trim();

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  _cachedPublicKey = await crypto.subtle.importKey(
    'spki',
    binaryDer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );
  _cachedPem = pem;
  return _cachedPublicKey;
}

/**
 * Converte ArrayBuffer/Uint8Array para base64 sem usar spread operator.
 * O spread pode causar "Maximum call stack size exceeded" em arrays grandes
 * (ex.: ciphertext de uma mensagem de log muito longa).
 */
function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  const CHUNK = 8192; // processa em blocos para evitar estouro de pilha
  for (let i = 0; i < arr.length; i += CHUNK) {
    binary += String.fromCharCode(...arr.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export async function encryptLogPayload(
  data: object,
  publicKeyPem: string,
  keyId: string,
): Promise<EncryptedLogPayload> {
  const publicKey = await importPublicKey(publicKeyPem);

  // Gera chave AES efêmera (descartada após o uso)
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt'],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));

  // Encripta o payload com AES-GCM
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded,
  );

  // Encripta a chave AES com a RSA public key
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const encryptedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawAesKey,
  );

  return {
    encrypted:     true,
    keyId,
    encryptedKey:  bufToBase64(encryptedKey),
    encryptedData: bufToBase64(encryptedData),
    iv:            bufToBase64(iv),
  };
}
