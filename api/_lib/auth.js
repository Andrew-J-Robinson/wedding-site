const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const DEFAULTS = {
  expiresIn: '15m',
  issuer: 'wedding-site-admin',
  audience: 'wedding-site-admin-api',
  algorithm: 'HS256'
};

const REVOCATIONS_TABLE = 'admin_token_revocations';

function getRequiredEnv(name, env = process.env) {
  const value = env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createSupabaseRevocationStore(client) {
  let effectiveClient = client;
  function getClient() {
    if (!effectiveClient) effectiveClient = require('./supabase');
    return effectiveClient;
  }
  return {
    async isRevoked(jti) {
      if (!jti) return false;
      const { data, error, status } = await getClient()
        .from(REVOCATIONS_TABLE)
        .select('jti')
        .eq('jti', jti)
        .maybeSingle();
      if (error && status !== 406) throw error;
      return !!data;
    },
    async revoke(jti, expiresAt) {
      if (!jti) return;
      const { error } = await getClient().from(REVOCATIONS_TABLE).upsert({
        jti,
        expires_at: expiresAt
      });
      if (error) throw error;
    }
  };
}

function createAuthService({
  env = process.env,
  revocationStore = createSupabaseRevocationStore(),
  randomUUID = () => crypto.randomUUID()
} = {}) {
  function getConfig() {
    return {
      secret: getRequiredEnv('JWT_SECRET', env),
      adminPassword: getRequiredEnv('ADMIN_PASSWORD', env),
      ...DEFAULTS
    };
  }

  function signToken() {
    const config = getConfig();
    return jwt.sign(
      { role: 'admin' },
      config.secret,
      {
        expiresIn: config.expiresIn,
        issuer: config.issuer,
        audience: config.audience,
        algorithm: config.algorithm,
        jwtid: randomUUID(),
        subject: 'admin'
      }
    );
  }

  function isValidAdminPassword(password) {
    const config = getConfig();
    return password === config.adminPassword;
  }

  async function verifyAuth(req) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return false;

    try {
      const config = getConfig();
      const decoded = jwt.verify(token, config.secret, {
        algorithms: [config.algorithm],
        issuer: config.issuer,
        audience: config.audience
      });
      if (decoded?.role !== 'admin' || decoded?.sub !== 'admin') return false;
      return !(await revocationStore.isRevoked(decoded.jti));
    } catch {
      return false;
    }
  }

  async function revokeToken(token) {
    const config = getConfig();
    const decoded = jwt.verify(token, config.secret, {
      algorithms: [config.algorithm],
      issuer: config.issuer,
      audience: config.audience
    });
    if (!decoded?.jti) return;
    await revocationStore.revoke(decoded.jti, decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null);
  }

  return { signToken, verifyAuth, isValidAdminPassword, revokeToken };
}

const defaultAuthService = createAuthService();

module.exports = {
  signToken: defaultAuthService.signToken,
  verifyAuth: defaultAuthService.verifyAuth,
  isValidAdminPassword: defaultAuthService.isValidAdminPassword,
  revokeToken: defaultAuthService.revokeToken,
  createAuthService,
  createSupabaseRevocationStore
};
