const crypto = require('crypto');

const TOKEN_SEPARATOR = '.';
const TOKEN_TTL_SECONDS = 60 * 60 * 12;
const SCRYPT_KEY_LENGTH = 64;

function normalizeBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function getAuthConfig() {
  return {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    secret: process.env.AUTH_SECRET || process.env.JWT_SECRET || 'change-me-in-production',
    allowAdminPrivilegeChanges: normalizeBoolean(process.env.ALLOW_ADMIN_PRIVILEGE_CHANGES),
  };
}

function timingSafeEqual(a, b) {
  const aBuffer = Buffer.from(String(a));
  const bBuffer = Buffer.from(String(b));

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }

  const [salt, originalHash] = storedHash.split(':');
  const candidateHash = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return timingSafeEqual(originalHash, candidateHash);
}

function createToken(user) {
  const { secret } = getAuthConfig();
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    username: user.username,
    isAdmin: Boolean(user.is_admin ?? user.isAdmin),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  })).toString('base64url');

  const signature = signPayload(payload, secret);
  return `${payload}${TOKEN_SEPARATOR}${signature}`;
}

function verifyToken(token) {
  if (!token || !token.includes(TOKEN_SEPARATOR)) {
    return null;
  }

  const [payload, signature] = token.split(TOKEN_SEPARATOR);
  const { secret } = getAuthConfig();
  const expectedSignature = signPayload(payload, secret);

  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch (_error) {
    return null;
  }
}

function extractBearerToken(headerValue) {
  if (!headerValue || !headerValue.startsWith('Bearer ')) {
    return null;
  }

  return headerValue.slice('Bearer '.length).trim();
}

function requireAuth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = payload;
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  return next();
}

function canManageAdminPrivileges() {
  return getAuthConfig().allowAdminPrivilegeChanges;
}

module.exports = {
  canManageAdminPrivileges,
  createToken,
  extractBearerToken,
  getAuthConfig,
  hashPassword,
  requireAdmin,
  requireAuth,
  verifyPassword,
  verifyToken,
};
