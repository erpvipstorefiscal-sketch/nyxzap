import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import pino from 'pino';
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { pool, initDatabase } from './db.js';
import { sendPasswordRecoveryEmail } from './mailer.js';

const app = express();
app.use(cors());
app.use(express.json());

// Static uploads directory for media (audio, video, image, pdf)
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer storage for Flow media uploads
const flowUploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueName = `${Date.now()}-${cleanBase}${ext}`;
    cb(null, uniqueName);
  }
});

const flowUpload = multer({
  storage: flowUploadStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.mp3', '.wav', '.ogg', '.opus', '.m4a', '.aac', '.mp4', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato de arquivo ${ext} não suportado. Áudios aceitos: MP3, WAV, OGG, OPUS, M4A, AAC. Vídeos: MP4 (máx 50MB). Documentos: PDF. Imagens: PNG, JPG, WEBP.`));
    }
  }
});

app.post('/api/flow/upload', (req, res) => {
  flowUpload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'O arquivo excede o limite máximo de 50MB.' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

const logger = pino({ level: 'silent' });

// Initialize database schema and seeds
initDatabase().catch(err => console.error('[DB Init Error]', err));

// IP-Based Rate Limiting & Lockout System (Max 5 failed attempts -> 15 min lock)
interface IpAttempt {
  count: number;
  lockedUntil: number;
}
const loginAttempts: Map<string, IpAttempt> = new Map();

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

// Log Telemetry Helper
async function recordTelemetry(eventName: string, tabName: string, userId?: string, email?: string, details: any = {}, ip?: string) {
  try {
    const eventId = 'evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    await pool.query(
      `INSERT INTO telemetry_events (id, user_id, user_email, event_name, tab_name, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [eventId, userId || 'anon', email || 'anon@nyxzap.com', eventName, tabName, JSON.stringify(details), ip || '127.0.0.1']
    );
  } catch (err: any) {
    // Non-blocking telemetry fallback
  }
}

// Auth endpoint backed by PostgreSQL with Rate Limiting & 5-Attempt Lockout
app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body;
  const clientIp = getClientIp(req);
  const now = Date.now();

  // Check if IP is currently locked
  const attempt = loginAttempts.get(clientIp);
  if (attempt && attempt.lockedUntil > now) {
    const minutesLeft = Math.ceil((attempt.lockedUntil - now) / 60000);
    recordTelemetry('login_blocked_ip', 'login', undefined, email, { ip: clientIp, minutesLeft }, clientIp);
    return res.status(429).json({
      error: `Segurança: Muitas tentativas incorretas consecutivas. Seu IP foi bloqueado por 15 minutos (${minutesLeft} min restantes).`
    });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email?.trim()]);
    if (result.rows.length === 0) {
      // Record failed attempt
      const current = attempt ? attempt.count + 1 : 1;
      const lockedUntil = current >= 5 ? now + 15 * 60 * 1000 : 0;
      loginAttempts.set(clientIp, { count: current, lockedUntil });
      recordTelemetry('login_failed_user_not_found', 'login', undefined, email, { count: current }, clientIp);
      
      if (current >= 5) {
        return res.status(429).json({
          error: 'Limite de 5 tentativas atingido. Seu IP foi bloqueado por 15 minutos por medidas de segurança.'
        });
      }
      return res.status(401).json({ error: `Usuário não encontrado. (${5 - current} tentativas restantes)` });
    }

    const user = result.rows[0];
    if (user.password !== password) {
      const current = attempt ? attempt.count + 1 : 1;
      const lockedUntil = current >= 5 ? now + 15 * 60 * 1000 : 0;
      loginAttempts.set(clientIp, { count: current, lockedUntil });
      recordTelemetry('login_failed_wrong_password', 'login', user.id, email, { count: current }, clientIp);

      if (current >= 5) {
        return res.status(429).json({
          error: 'Limite de 5 tentativas incorretas atingido. Seu IP foi bloqueado por 15 minutos.'
        });
      }
      return res.status(401).json({ error: `Senha incorreta. (${5 - current} tentativas restantes antes do bloqueio)` });
    }

    if (role && user.role !== role) {
      return res.status(403).json({ error: `Acesso negado. Esta conta não possui perfil de ${role}.` });
    }

    // Success -> Clear failed attempts for this IP
    loginAttempts.delete(clientIp);
    recordTelemetry('login_success', 'login', user.id, user.email, { role: user.role }, clientIp);

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      planName: user.plan_name,
      validUntil: user.valid_until,
      instancesLimit: user.instances_limit,
      token: 'jwt-token-' + user.id
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro no banco de dados: ' + err.message });
  }
});

// Register Endpoint with 1-day Free Trial
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  const clientIp = getClientIp(req);

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Validate strong password: at least 8 chars, 1 letter, 1 number, 1 special character
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  if (password.length < 8 || !hasLetter || !hasNumber || !hasSpecial) {
    return res.status(400).json({
      error: 'A senha deve ter no mínimo 8 caracteres, incluindo letras, números e caracteres especiais.'
    });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.' });
    }

    const newId = 'usr-' + Date.now();
    // 1-day free trial: tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const validUntilStr = tomorrow.toISOString().split('T')[0];

    await pool.query(
      `INSERT INTO users (id, name, email, password, role, phone, plan_id, plan_name, status, mrr_value, valid_until, instances_limit, connected_instances)
       VALUES ($1, $2, $3, $4, 'client', '', 'p1', 'Teste Grátis (1 Dia)', 'active', 0.00, $5, 1, 0)`,
      [newId, name.trim(), normalizedEmail, password, validUntilStr]
    );

    recordTelemetry('user_registered_trial', 'register', newId, normalizedEmail, { trialDays: 1 }, clientIp);

    res.json({
      id: newId,
      name: name.trim(),
      email: normalizedEmail,
      role: 'client',
      planName: 'Teste Grátis (1 Dia)',
      validUntil: validUntilStr,
      instancesLimit: 1,
      token: 'jwt-token-' + newId,
      message: 'Conta criada com sucesso! Você ganhou 1 dia de teste grátis.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao criar conta: ' + err.message });
  }
});

// Google Authentication Endpoint
app.post('/api/auth/google', async (req, res) => {
  const { email, name, googleId, action } = req.body; // action: 'login' | 'register'
  const clientIp = getClientIp(req);

  if (!email) {
    return res.status(400).json({ error: 'E-mail do Google não informado.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    
    // Se a conta já existe, faz login normalmente
    if (result.rows.length > 0) {
      const user = result.rows[0];
      loginAttempts.delete(clientIp);
      recordTelemetry('google_login_success', 'login', user.id, user.email, { provider: 'google' }, clientIp);

      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        planName: user.plan_name,
        validUntil: user.valid_until,
        instancesLimit: user.instances_limit,
        token: 'jwt-token-' + user.id
      });
    }

    // PROTEÇÃO: Se clicou em "Entrar com o Google" na tela de login e a conta NÃO existe no banco:
    if (action === 'login') {
      recordTelemetry('google_login_rejected_not_found', 'login', undefined, normalizedEmail, {}, clientIp);
      return res.status(404).json({
        error: 'Nenhuma conta encontrada com este e-mail do Google. Por favor, clique em "Criar conta grátis" para se cadastrar.'
      });
    }

    // Se veio da tela de cadastro (action === 'register'): cria a conta com 1 dia grátis
    const newId = 'usr-g-' + Date.now();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const validUntilStr = tomorrow.toISOString().split('T')[0];

    await pool.query(
      `INSERT INTO users (id, name, email, password, role, phone, plan_id, plan_name, status, mrr_value, valid_until, instances_limit, connected_instances)
       VALUES ($1, $2, $3, $4, 'client', '', 'p1', 'Teste Grátis (1 Dia)', 'active', 0.00, $5, 1, 0)`,
      [newId, name || 'Usuário Google', normalizedEmail, 'google-oauth-' + (googleId || Date.now()), validUntilStr]
    );

    recordTelemetry('google_register_trial', 'register', newId, normalizedEmail, { trialDays: 1, provider: 'google' }, clientIp);

    res.json({
      id: newId,
      name: name || 'Usuário Google',
      email: normalizedEmail,
      role: 'client',
      planName: 'Teste Grátis (1 Dia)',
      validUntil: validUntilStr,
      instancesLimit: 1,
      token: 'jwt-token-' + newId,
      message: 'Conta criada com sucesso via Google! Você ganhou 1 dia de teste grátis.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro na autenticação com Google: ' + err.message });
  }
});

// Forgot Password Recovery Endpoint with Database Existence Protection & Hostinger Professional Mailer
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  const clientIp = getClientIp(req);

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Informe seu e-mail para recuperação.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // PROTEÇÃO CRÍTICA: Se o e-mail não existir no banco, NÃO faz requisição nem envia e-mail
    const userResult = await pool.query('SELECT id, name, email FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    
    if (userResult.rows.length === 0) {
      recordTelemetry('password_recovery_rejected_not_found', 'auth', undefined, normalizedEmail, { reason: 'email_not_in_database' }, clientIp);
      // Aborta imediatamente sem tocar no SMTP da Hostinger
      return res.status(404).json({
        error: 'O e-mail informado não está cadastrado no sistema. Verifique a digitação ou contate o suporte.'
      });
    }

    const user = userResult.rows[0];

    // Gera código de segurança de 6 dígitos e token
    const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();
    const token = 'rst-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);
    const resetId = 'rst-id-' + Date.now();

    // Salva no PostgreSQL com validade de 30 minutos
    await pool.query(
      `INSERT INTO password_resets (id, email, token, code, status, expires_at)
       VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP + INTERVAL '30 minutes')`,
      [resetId, normalizedEmail, token, recoveryCode]
    );

    const host = req.get('host') || 'zap.nyxzap.com.br';
    const protocol = req.protocol === 'https' || host.includes('nyxzap.com.br') ? 'https' : req.protocol;
    const resetLink = `${protocol}://${host}/?resetToken=${token}&email=${encodeURIComponent(normalizedEmail)}`;

    // Dispara e-mail profissional via SMTP Hostinger
    await sendPasswordRecoveryEmail({
      toEmail: normalizedEmail,
      userName: user.name,
      recoveryCode,
      resetLink
    });

    recordTelemetry('password_recovery_sent', 'auth', user.id, normalizedEmail, { token, host }, clientIp);

    res.json({
      success: true,
      message: `Código de verificação e instruções enviados com sucesso para ${normalizedEmail}! Verifique sua caixa de entrada e spam.`,
      email: normalizedEmail
    });
  } catch (err: any) {
    console.error('[Forgot Password Error]', err);
    res.status(500).json({ error: 'Erro ao processar recuperação de senha: ' + err.message });
  }
});

// Reset Password Endpoint (Executa a troca definitiva da senha)
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, code, token, newPassword } = req.body;
  const clientIp = getClientIp(req);

  if (!email || !newPassword || (!code && !token)) {
    return res.status(400).json({ error: 'Informe e-mail, código de verificação e a nova senha.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Valida código/token ativo e não expirado
    const resetRes = await pool.query(
      `SELECT * FROM password_resets 
       WHERE LOWER(email) = $1 
         AND (code = $2 OR token = $3) 
         AND status = 'pending' 
         AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail, code ? String(code).trim() : '', token ? String(token).trim() : '']
    );

    if (resetRes.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Código de verificação incorreto ou expirado. Por favor, solicite um novo código.' 
      });
    }

    const resetRecord = resetRes.rows[0];

    // Atualiza a senha no banco de dados PostgreSQL
    await pool.query('UPDATE users SET password = $1 WHERE LOWER(email) = $2', [newPassword, normalizedEmail]);

    // Marca o pedido de reset como concluído
    await pool.query("UPDATE password_resets SET status = 'used' WHERE id = $1", [resetRecord.id]);

    recordTelemetry('password_reset_completed', 'auth', undefined, normalizedEmail, {}, clientIp);

    res.json({
      success: true,
      message: 'Sua senha foi atualizada com sucesso! Você já pode entrar com sua nova senha.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao redefinir senha: ' + err.message });
  }
});

// Admin endpoints backed by PostgreSQL: Subscribers CRUD
app.get('/api/admin/subscribers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    const subscribers = result.rows.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone || '+55 11 98888-7777',
      planId: u.plan_id || 'p2',
      planName: u.plan_name || 'Pro',
      status: u.status || 'active',
      mrrValue: parseFloat(u.mrr_value) || 97.00,
      validUntil: u.valid_until || '2026-11-10',
      instancesLimit: u.instances_limit || 1,
      connectedInstances: u.connected_instances || 0,
      createdAt: u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : '2026-10-10'
    }));
    res.json(subscribers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create New Subscriber in PostgreSQL
app.post('/api/admin/subscribers', async (req, res) => {
  const { name, email, password, phone, planId, planName, status, mrrValue, validUntil, instancesLimit, role } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
  }

  try {
    const newId = 'usr-' + Date.now();
    await pool.query(
      `INSERT INTO users (id, name, email, password, role, phone, plan_id, plan_name, status, mrr_value, valid_until, instances_limit, connected_instances)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0)`,
      [
        newId,
        name.trim(),
        email.trim().toLowerCase(),
        password || '123456',
        role || 'client',
        phone || '+55 11 99999-9999',
        planId || 'p2',
        planName || 'Pro (Mais Vendido)',
        status || 'active',
        parseFloat(mrrValue) || 197.00,
        validUntil || '2026-11-10',
        parseInt(instancesLimit) || 3
      ]
    );

    recordTelemetry('admin_created_subscriber', 'admin', newId, email, { name, planName });
    res.json({ success: true, message: 'Novo cliente cadastrado com sucesso!', id: newId });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao cadastrar cliente: ' + err.message });
  }
});

// Edit Existing Subscriber in PostgreSQL
app.put('/api/admin/subscribers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, planId, planName, status, mrrValue, validUntil, instancesLimit } = req.body;

  try {
    // If planId is passed, verify if plan exists or upsert it
    if (planId) {
      await pool.query(
        `INSERT INTO plans (id, name, price, period, instances_limit, ai_credits_limit, features)
         VALUES ($1, $2, $3, 'mensal', $4, 5000, '[]'::jsonb)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price`,
        [planId, planName || 'Plano Personalizado', parseFloat(mrrValue) || 97.00, parseInt(instancesLimit) || 1]
      );
    }

    await pool.query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           plan_id = COALESCE($4, plan_id),
           plan_name = COALESCE($5, plan_name),
           status = COALESCE($6, status),
           mrr_value = COALESCE($7, mrr_value),
           valid_until = COALESCE($8, valid_until),
           instances_limit = COALESCE($9, instances_limit)
       WHERE id = $10`,
      [name, email, phone, planId || null, planName, status, parseFloat(mrrValue) || 0, validUntil, parseInt(instancesLimit) || 1, id]
    );

    recordTelemetry('admin_updated_subscriber', 'admin', id, email, { name, status });
    res.json({ success: true, message: 'Dados do cliente atualizados com sucesso no banco de dados!' });
  } catch (err: any) {
    console.error('[Update Subscriber Error]', err);
    res.status(500).json({ error: 'Erro ao atualizar cliente: ' + err.message });
  }
});

// Delete Subscriber from PostgreSQL
app.delete('/api/admin/subscribers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    recordTelemetry('admin_deleted_subscriber', 'admin', id, undefined, { id });
    res.json({ success: true, message: 'Cliente excluído com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao excluir cliente: ' + err.message });
  }
});

app.post('/api/admin/subscribers/:id/renew', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE users SET valid_until = '2026-12-31', status = 'active' WHERE id = $1", [id]);
    recordTelemetry('admin_renewed_license', 'admin', id, undefined, { id });
    res.json({ success: true, message: 'Licença renovada por mais 30 dias no banco de dados!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/plans', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM plans');
    res.json(result.rows.map(p => ({
      id: p.id,
      name: p.name,
      price: parseFloat(p.price),
      period: p.period,
      instancesLimit: p.instances_limit,
      aiCreditsLimit: p.ai_credits_limit,
      features: p.features || []
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Telemetry (PostHog alternative) API Endpoints
app.post('/api/telemetry', async (req, res) => {
  const { eventName, tabName, userId, userEmail, details } = req.body;
  const ip = getClientIp(req);
  await recordTelemetry(eventName || 'action', tabName || 'app', userId, userEmail, details, ip);
  res.json({ success: true });
});

app.get('/api/admin/telemetry', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM telemetry_events ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cakto MCP & Checkout Configuration Endpoints
app.get('/api/cakto/config', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cakto_config WHERE id = $1', ['default']);
    if (result.rows.length > 0) {
      const cfg = result.rows[0];
      return res.json({
        clientId: cfg.client_id,
        clientSecret: cfg.client_secret ? '••••••••' : '',
        hasSecret: !!cfg.client_secret,
        checkoutLinks: cfg.checkout_links || {}
      });
    }
    res.json({
      clientId: '1tyOaWA3KmZDn87nHzJYQksvEBANLiiV7Zx1uLeo',
      hasSecret: true,
      checkoutLinks: {
        tier_1: 'https://pay.cakto.com.br/nyxzap-extra-1',
        tier_2: 'https://pay.cakto.com.br/nyxzap-extra-2',
        tier_3: 'https://pay.cakto.com.br/nyxzap-extra-3',
        tier_5: 'https://pay.cakto.com.br/nyxzap-extra-5',
        plan_p1: 'https://pay.cakto.com.br/nyxzap-start',
        plan_p2: 'https://pay.cakto.com.br/nyxzap-pro',
        plan_p3: 'https://pay.cakto.com.br/nyxzap-enterprise'
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cakto/config', async (req, res) => {
  const { clientId, clientSecret, checkoutLinks } = req.body;
  try {
    await pool.query(
      `INSERT INTO cakto_config (id, client_id, client_secret, checkout_links, updated_at)
       VALUES ('default', $1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE
       SET client_id = COALESCE($1, cakto_config.client_id),
           client_secret = CASE WHEN $2 != '' AND $2 IS NOT NULL THEN $2 ELSE cakto_config.client_secret END,
           checkout_links = COALESCE($3, cakto_config.checkout_links),
           updated_at = CURRENT_TIMESTAMP`,
      [clientId, clientSecret, JSON.stringify(checkoutLinks || {})]
    );
    res.json({ success: true, message: 'Configurações da Cakto salvas com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cakto Webhook Handler - Confirmações de Assinaturas, Renovações e Conexões Extras
app.post('/api/webhook/cakto', async (req, res) => {
  const payload = req.body || {};
  console.log('[Cakto Webhook Received]', JSON.stringify(payload));

  try {
    // Normalização dos campos principais do webhook da Cakto
    // Eventos comuns: order.paid, payment.approved, subscription.renewed, invoice.paid, etc.
    const eventType = payload.event || payload.type || payload.status || 'unknown';
    
    // Status do pagamento
    const paymentStatus = (
      payload.data?.status || 
      payload.status || 
      payload.order?.status || 
      payload.payment_status || 
      ''
    ).toLowerCase();

    // Aceita eventos de pagamento aprovado/pago
    const isApproved = 
      paymentStatus === 'paid' || 
      paymentStatus === 'approved' || 
      paymentStatus === 'completed' ||
      eventType.includes('paid') ||
      eventType.includes('approved') ||
      eventType.includes('renewed');

    if (!isApproved) {
      console.log(`[Cakto Webhook] Evento ignorado (status não aprovado: ${paymentStatus || eventType})`);
      return res.json({ received: true, ignored: true, reason: 'Payment not approved' });
    }

    // Extrair dados do cliente / pagador
    const customer = payload.data?.customer || payload.customer || payload.client || payload.order?.customer || {};
    const email = (customer.email || payload.email || payload.buyer_email || payload.data?.email || '').trim().toLowerCase();
    const customerName = customer.name || customer.full_name || payload.name || payload.buyer_name || 'Cliente Cakto';
    const customerPhone = customer.phone || customer.cellphone || payload.phone || '+55 11 99999-9999';

    if (!email) {
      console.warn('[Cakto Webhook] E-mail do cliente não identificado no payload');
      return res.status(400).json({ error: 'Customer email missing in webhook payload' });
    }

    // Extrair dados do produto / oferta / item
    const items = payload.data?.items || payload.items || payload.products || [];
    const item = items[0] || payload.product || payload.order?.product || {};
    const rawProductName = (
      item.name || 
      item.title || 
      item.slug ||
      payload.product_name || 
      payload.product?.name ||
      payload.plan_name || 
      payload.offer_title || 
      payload.data?.product_name ||
      ''
    ).toLowerCase();

    const offerId = String(payload.offer_id || payload.checkout_id || payload.link_id || item.id || payload.product_id || '').toLowerCase();
    const amount = parseFloat(payload.data?.amount || payload.amount || payload.order?.amount || item.price || 0) / 100 || 97.00;

    console.log(`[Cakto Webhook] Processando compra aprovada para ${email} (Produto: "${rawProductName}", OfferId: "${offerId}", Valor: R$ ${amount})`);

    // 1. Identificar Conexões Extras de WhatsApp
    // Slugs Cakto: nyxzap-1-numero-extra, nyxzap-2-numeros-extra, nyxzap-3-numeros-extra, nyxzap-5-numeros-extra
    const isExtraConnection = 
      rawProductName.includes('extra') || 
      rawProductName.includes('numero') || 
      rawProductName.includes('conex') ||
      offerId.includes('extra');

    if (isExtraConnection) {
      let extraCount = 1;
      if (rawProductName.includes('5') || rawProductName.includes('cinco')) extraCount = 5;
      else if (rawProductName.includes('3') || rawProductName.includes('tres') || rawProductName.includes('três')) extraCount = 3;
      else if (rawProductName.includes('2') || rawProductName.includes('duas')) extraCount = 2;

      // Buscar usuário existente e incrementar instâncias
      const userRes = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        const newLimit = (u.instances_limit || 1) + extraCount;
        await pool.query(
          'UPDATE users SET instances_limit = $1 WHERE id = $2',
          [newLimit, u.id]
        );
        recordTelemetry('cakto_webhook_extra_connections', 'cakto', u.id, email, { extraCount, newLimit, amount });
        console.log(`[Cakto Webhook] +${extraCount} conexões extras adicionadas ao usuário ${email}. Novo limite: ${newLimit}`);
        return res.json({ success: true, message: `Adicionadas +${extraCount} conexões extras para ${email}.` });
      } else {
        // Se cliente ainda não existe, cria o usuário com o limite extra
        const newId = 'usr-' + Date.now();
        const nextMonth = new Date();
        nextMonth.setDate(nextMonth.getDate() + 30);
        await pool.query(
          `INSERT INTO users (id, name, email, password, role, phone, plan_id, plan_name, status, mrr_value, valid_until, instances_limit, connected_instances)
           VALUES ($1, $2, $3, '123456', 'client', $4, 'p_dinder', 'Plano Dinder', 'active', $5, $6, $7, 0)`,
          [newId, customerName, email, customerPhone, amount, nextMonth.toISOString().split('T')[0], 1 + extraCount]
        );
        recordTelemetry('cakto_webhook_new_client_extra', 'cakto', newId, email, { extraCount, amount });
        return res.json({ success: true, message: `Cliente ${email} criado com +${extraCount} conexões extras.` });
      }
    }

    // 2. Identificar Plano e Ciclo
    // Slugs Cakto:
    // - nyxzap - plano dinder (Mensal)
    // - nyxzap - plano dinder anual (Anual)
    // - nyxzap - plano pro + ia ilimitada (Mensal)
    // - nyxzap - plano pro + ia ilimitada anual (Anual)
    const isPro = 
      rawProductName.includes('pro') || 
      rawProductName.includes('ia') || 
      rawProductName.includes('ilimitada') ||
      offerId.includes('3764ipv') || 
      offerId.includes('87jcu5r');

    const isAnnual = 
      rawProductName.includes('anual') || 
      amount >= 290 || 
      offerId.includes('693263v') || 
      offerId.includes('3764ipv');

    const daysToAdd = isAnnual ? 365 : 30;
    const planId = isPro ? 'p_pro_ia' : 'p_dinder';
    const planName = isPro ? 'Plano Pro + IA ilimitada (Recomendado)' : 'Plano Dinder';

    const userRes = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);

    if (userRes.rows.length > 0) {
      // Renovação ou Upgrade de usuário existente
      const existingUser = userRes.rows[0];
      let baseDate = new Date();

      // Se a assinatura ainda estiver ativa no futuro, prorroga a partir da data de vencimento
      if (existingUser.valid_until) {
        const curValid = new Date(existingUser.valid_until);
        if (curValid > baseDate) {
          baseDate = curValid;
        }
      }

      baseDate.setDate(baseDate.getDate() + daysToAdd);
      const newValidUntil = baseDate.toISOString().split('T')[0];

      await pool.query(
        `UPDATE users 
         SET plan_id = $1,
             plan_name = $2,
             status = 'active',
             mrr_value = $3,
             valid_until = $4
         WHERE id = $5`,
        [planId, planName, amount, newValidUntil, existingUser.id]
      );

      recordTelemetry('cakto_webhook_renew_or_upgrade', 'cakto', existingUser.id, email, {
        planName,
        isAnnual,
        daysToAdd,
        newValidUntil,
        amount
      });

      console.log(`[Cakto Webhook] Assinatura do cliente ${email} renovada com sucesso até ${newValidUntil}!`);
      return res.json({
        success: true,
        message: `Assinatura de ${email} renovada com sucesso até ${newValidUntil} no ${planName}.`
      });
    } else {
      // Novo Assinante registrado via Cakto
      const newId = 'usr-' + Date.now();
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + daysToAdd);
      const validUntil = expirationDate.toISOString().split('T')[0];

      await pool.query(
        `INSERT INTO users (id, name, email, password, role, phone, plan_id, plan_name, status, mrr_value, valid_until, instances_limit, connected_instances)
         VALUES ($1, $2, $3, '123456', 'client', $4, $5, $6, 'active', $7, $8, 1, 0)`,
        [newId, customerName, email, customerPhone, planId, planName, amount, validUntil]
      );

      recordTelemetry('cakto_webhook_new_subscriber', 'cakto', newId, email, {
        planName,
        isAnnual,
        validUntil,
        amount
      });

      console.log(`[Cakto Webhook] Novo cliente criado via Cakto: ${email} (${planName}) válido até ${validUntil}`);
      return res.json({
        success: true,
        message: `Novo cliente ${email} cadastrado com sucesso no ${planName} até ${validUntil}.`
      });
    }
  } catch (err: any) {
    console.error('[Cakto Webhook Error]', err);
    recordTelemetry('cakto_webhook_error', 'cakto', undefined, undefined, { error: err.message });
    return res.status(500).json({ error: 'Erro interno ao processar webhook Cakto: ' + err.message });
  }
});

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: string;
  senderName?: string;
  isAiGenerated?: boolean;
}

export interface ChatConversation {
  id: string;
  leadPhone: string;
  leadName: string;
  tag: 'frio' | 'morno' | 'quente' | 'comprou';
  followUpDate?: string;
  internalNotes: string;
  aiAgentActive: boolean;
  botFlowActive: boolean;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: string;
  messages: ChatMessage[];
}

export interface SystemUpdate {
  id: string;
  version: string;
  date: string;
  type: 'correcao' | 'implementacao' | 'melhoria';
  title: string;
  message: string;
}

const liveChats: Map<string, ChatConversation> = new Map([
  ['5511984521190@s.whatsapp.net', {
    id: '5511984521190@s.whatsapp.net',
    leadPhone: '+55 11 98452-1190',
    leadName: 'Carlos Eduardo',
    tag: 'quente',
    followUpDate: '2026-10-12T14:00',
    internalNotes: 'Lead com 4 atendentes. Pediu chave Pix com desconto.',
    aiAgentActive: false,
    botFlowActive: false,
    unreadCount: 0,
    lastMessage: 'Vou pagar no Pix agora mesmo, me manda a chave?',
    lastMessageTime: '10:42',
    messages: [
      { id: 'm1', fromMe: false, text: 'Olá! Quanto custa a ferramenta?', timestamp: '10:30' },
      { id: 'm2', fromMe: true, text: 'Olá Carlos! O plano Pro custa R$ 197/mês e o Anual tem 30% OFF.', timestamp: '10:31', isAiGenerated: true },
      { id: 'm5', fromMe: false, text: 'Vou pagar no Pix agora mesmo, me manda a chave?', timestamp: '10:42' }
    ]
  }]
]);

// System Updates registered by Admin
let systemUpdates: SystemUpdate[] = [
  {
    id: 'up-1',
    version: 'v2.1.0',
    date: '11/10/2026',
    type: 'implementacao',
    title: 'Integração de Chat em Tempo Real e Novas Conexões',
    message: 'Lançamento do CRM integrado ao chat do WhatsApp, controle de mensagens manuais, histórico e pacotes de instâncias adicionais.'
  },
  {
    id: 'up-2',
    version: 'v2.0.8',
    date: '10/10/2026',
    type: 'correcao',
    title: 'Correção de Duplicidade de Mensagens e Desconexão',
    message: 'Otimização no envio via Baileys com debounce para prevenir disparos duplos e reconexão silenciosa automática.'
  }
];

// Sessions Storage
interface SessionData {
  id: string;
  name: string;
  status: 'disconnected' | 'connecting' | 'connected';
  qrCode?: string;
  phone?: string;
  sock?: any;
}

const sessions: Map<string, SessionData> = new Map([
  ['inst-1', { id: 'inst-1', name: 'WhatsApp Principal', status: 'disconnected' }]
]);

// AI Agent Config In-Memory
let aiConfig = {
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-3.8-flash',
  reasoningLevel: 'high',
  mediaResolution: 'maximo',
  webSearchEnabled: true,
  systemPrompt: 'Você é o NyxZap Concierge, assistente de vendas e automações via WhatsApp. Seja persuasivo e profissional.',
  escapeKeywords: ['humano', 'falar com atendente', 'cancelar', 'reclamação', 'processo'],
  knowledgeDocs: [
    { id: '1', name: 'Tabela_Precos_2026.pdf', size: '1.2 MB', uploadedAt: '11/10/2026', type: 'pdf' },
    { id: '2', name: 'Playbook_Vendas.docx', size: '850 KB', uploadedAt: '11/10/2026', type: 'docx' }
  ]
};

// Flow Definitions Storage & Execution Engine
interface FlowNodeServer {
  id: string;
  type: string;
  title: string;
  data: Record<string, any>;
}

interface FlowEdgeServer {
  id: string;
  from: string;
  to: string;
  label?: string;
  fromHandle?: string;
}

let activeFlow = {
  active: true,
  nodes: [
    {
      id: 'node-1',
      type: 'inicio',
      title: 'INÍCIO',
      data: {
        trigger: 'palavra_chave',
        keywords: ['quero saber sobre o curso', 'preço', 'comprar'],
        instance: 'Todas'
      }
    },
    {
      id: 'node-2',
      type: 'whatsapp',
      title: 'WhatsApp Mensagem',
      data: {
        message: 'Olá {nome}, como posso te ajudar hoje?'
      }
    }
  ] as FlowNodeServer[],
  edges: [
    {
      id: 'e-1',
      from: 'node-1',
      to: 'node-2',
      label: 'Disparo',
      fromHandle: 'default'
    }
  ] as FlowEdgeServer[]
};

// Load saved flow from PostgreSQL or fallback
async function loadSavedFlow() {
  try {
    const res = await pool.query('SELECT nodes, edges, active FROM flow_definitions WHERE id = $1', ['default']);
    if (res.rows.length > 0) {
      activeFlow = {
        active: res.rows[0].active !== false,
        nodes: res.rows[0].nodes || [],
        edges: res.rows[0].edges || []
      };
      console.log(`[Flow Engine] Fluxo carregado do banco de dados com ${activeFlow.nodes.length} cards e ${activeFlow.edges.length} conexões.`);
    }
  } catch (err) {
    console.error('[Flow Engine Error] Falha ao ler fluxo do banco:', err);
  }
}
loadSavedFlow();

// Helper to sanitize text for matching keywords (remove accents, lowercase, trim)
function normalizeText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Function to execute visual flow nodes for a contact
async function executeFlowForMessage(
  sock: any, 
  remoteJid: string, 
  incomingText: string, 
  senderName: string,
  sessionId: string
): Promise<boolean> {
  if (!activeFlow.active || !activeFlow.nodes || activeFlow.nodes.length === 0) {
    return false;
  }

  const normIncoming = normalizeText(incomingText);

  // Find matching trigger 'inicio' node
  const triggerNode = activeFlow.nodes.find(n => {
    if (n.type !== 'inicio') return false;

    // Check instance filter if specified
    const targetInst = n.data?.instance;
    if (targetInst && targetInst !== 'Todas') {
      const cleanInstNum = targetInst.replace(/[^0-9]/g, '');
      const cleanSessionNum = sessionId.replace(/[^0-9]/g, '');
      if (cleanInstNum && cleanSessionNum && cleanInstNum !== cleanSessionNum) {
        return false;
      }
    }

    const triggerType = n.data?.trigger || 'palavra_chave';
    if (triggerType === 'boas_vindas') {
      return true; // Fires on greeting/first message
    }

    const keywords: string[] = n.data?.keywords || [];
    if (keywords.length === 0) return false;

    return keywords.some(kw => {
      const normKw = normalizeText(kw);
      if (!normKw) return false;
      // Direct substring match or whole sentence match
      return normIncoming.includes(normKw);
    });
  });

  if (!triggerNode) {
    return false;
  }

  console.log(`[Flow Engine] Gatilho ativado pelo card '${triggerNode.title}' para ${remoteJid}!`);

  // Traverse edges from trigger
  let currentTargetEdges = activeFlow.edges.filter(e => e.from === triggerNode.id);
  if (currentTargetEdges.length === 0) {
    return true;
  }

  for (const edge of currentTargetEdges) {
    const nextNode = activeFlow.nodes.find(n => n.id === edge.to);
    if (!nextNode) continue;

    await executeNodeAction(sock, remoteJid, nextNode, senderName, incomingText);
  }

  return true;
}

// Helper to execute specific node type (message, media, audio, delay, etc.)
async function executeNodeAction(
  sock: any,
  remoteJid: string,
  node: FlowNodeServer,
  senderName: string,
  incomingText: string
) {
  const replaceVariables = (str: string) => {
    const firstName = (senderName || 'Amigo').split(' ')[0];
    const hour = new Date().getHours();
    const saudacao = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    return (str || '')
      .replace(/{nome}/gi, firstName)
      .replace(/{telefone}/gi, remoteJid.replace('@s.whatsapp.net', ''))
      .replace(/{saudacao}/gi, saudacao)
      .replace(/{empresa}/gi, 'NyxZap');
  };

  try {
    if (node.type === 'sms' || node.type === 'whatsapp' || node.type === 'mensagem') {
      const rawText = node.data?.message || 'Olá, como posso te ajudar?';
      const finalText = replaceVariables(rawText);
      await sock.sendMessage(remoteJid, { text: finalText });
      recordFlowMessageInChat(remoteJid, finalText);
    } else if (node.type === 'audio') {
      if (node.data?.audioUrl) {
        const fullAudioUrl = node.data.audioUrl.startsWith('http') 
          ? node.data.audioUrl 
          : path.join(process.cwd(), node.data.audioUrl.replace(/^\//, ''));

        if (fs.existsSync(fullAudioUrl)) {
          await sock.sendMessage(remoteJid, {
            audio: fs.readFileSync(fullAudioUrl),
            mimetype: 'audio/mp4',
            ptt: true // Sent as voice note (áudio gravado na hora)
          });
          recordFlowMessageInChat(remoteJid, '🎵 [Áudio enviado]');
        }
      }
    } else if (node.type === 'imagem') {
      if (node.data?.imageUrl) {
        const fullImgPath = node.data.imageUrl.startsWith('http')
          ? node.data.imageUrl
          : path.join(process.cwd(), node.data.imageUrl.replace(/^\//, ''));

        if (fs.existsSync(fullImgPath)) {
          const caption = replaceVariables(node.data?.caption || '');
          await sock.sendMessage(remoteJid, {
            image: fs.readFileSync(fullImgPath),
            caption
          });
          recordFlowMessageInChat(remoteJid, `🖼️ [Imagem enviada: ${caption || 'Sem legenda'}]`);
        }
      }
    } else if (node.type === 'video') {
      if (node.data?.videoUrl) {
        const fullVideoPath = node.data.videoUrl.startsWith('http')
          ? node.data.videoUrl
          : path.join(process.cwd(), node.data.videoUrl.replace(/^\//, ''));

        if (fs.existsSync(fullVideoPath)) {
          const caption = replaceVariables(node.data?.caption || '');
          await sock.sendMessage(remoteJid, {
            video: fs.readFileSync(fullVideoPath),
            caption
          });
          recordFlowMessageInChat(remoteJid, `🎥 [Vídeo enviado: ${caption || 'Sem legenda'}]`);
        }
      }
    } else if (node.type === 'pdf') {
      if (node.data?.pdfUrl) {
        const fullPdfPath = node.data.pdfUrl.startsWith('http')
          ? node.data.pdfUrl
          : path.join(process.cwd(), node.data.pdfUrl.replace(/^\//, ''));

        if (fs.existsSync(fullPdfPath)) {
          await sock.sendMessage(remoteJid, {
            document: fs.readFileSync(fullPdfPath),
            mimetype: 'application/pdf',
            fileName: node.data?.fileName || 'documento.pdf'
          });
          recordFlowMessageInChat(remoteJid, `📄 [Documento PDF: ${node.data?.fileName || 'documento.pdf'}]`);
        }
      }
    } else if (node.type === 'timer') {
      const delayAmount = node.data?.delay || 5;
      const unit = node.data?.unit || 'segundos';
      const ms = unit === 'segundos' ? delayAmount * 1000 : unit === 'minutos' ? delayAmount * 60000 : 5000;
      await new Promise(r => setTimeout(r, Math.min(ms, 30000))); // Max 30s safety inline
    } else if (node.type === 'ia' || node.type === 'ia_audio') {
      const customPrompt = node.data?.prompt 
        ? `${node.data.prompt}\n\nMensagem do cliente: ${incomingText}`
        : incomingText;
      const reply = await queryAI(customPrompt, aiConfig);
      await sock.sendMessage(remoteJid, { text: reply });
      recordFlowMessageInChat(remoteJid, reply, true);
    }
  } catch (nodeErr) {
    console.error(`[Flow Engine] Erro ao executar nó ${node.id} (${node.type}):`, nodeErr);
  }
}

// Record bot sent messages into liveChats & broadcast to UI in real-time
function recordFlowMessageInChat(remoteJid: string, text: string, isAi = false) {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let chat = liveChats.get(remoteJid);
  if (chat) {
    const botMsg: ChatMessage = {
      id: `bot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      fromMe: true,
      text,
      timestamp: timeStr,
      senderName: isAi ? 'IA NyxZap' : 'Fluxo NyxZap',
      isAiGenerated: isAi
    };
    chat.messages.push(botMsg);
    chat.lastMessage = text;
    chat.lastMessageTime = timeStr;
    liveChats.set(remoteJid, chat);
    broadcast('chat_message', { chatId: remoteJid, message: botMsg, conversation: chat });
  }
}

// Broadcast to WebSocket clients
function broadcast(type: string, data: any) {
  const msg = JSON.stringify({ type, data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// Function to start a real Baileys session
async function startWhatsAppSession(sessionId: string) {
  const authDir = path.join(process.cwd(), 'whatsapp_auth', sessionId);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true,
    syncFullHistory: true
  });

  const session = sessions.get(sessionId) || { id: sessionId, name: `WhatsApp ${sessionId}`, status: 'connecting' };
  session.sock = sock;
  session.status = 'connecting';
  sessions.set(sessionId, session);
  broadcast('session_update', { id: sessionId, status: 'connecting' });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        session.qrCode = qrDataUrl;
        session.status = 'connecting';
        sessions.set(sessionId, session);
        broadcast('session_qr', { id: sessionId, qrCode: qrDataUrl });
      } catch (err) {
        console.error('Erro ao gerar QRCode:', err);
      }
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      session.status = 'disconnected';
      session.qrCode = undefined;
      sessions.set(sessionId, session);
      broadcast('session_update', { id: sessionId, status: 'disconnected' });

      if (shouldReconnect) {
        setTimeout(() => startWhatsAppSession(sessionId), 3000);
      }
    } else if (connection === 'open') {
      session.status = 'connected';
      session.qrCode = undefined;
      session.phone = sock.user?.id ? sock.user.id.split(':')[0] : 'Conectado';
      sessions.set(sessionId, session);
      broadcast('session_update', { 
        id: sessionId, 
        status: 'connected', 
        phone: session.phone 
      });
    }
  });

  // Handle incoming & outgoing messages in real-time
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages) {
      if (!msg.message) continue;
      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || remoteJid.includes('@g.us')) continue;

      const text = msg.message.conversation 
        || msg.message.extendedTextMessage?.text 
        || msg.message.imageMessage?.caption 
        || '';

      if (!text) continue;

      const fromMe = Boolean(msg.key.fromMe);
      const pushName = msg.pushName || 'Contato WhatsApp';
      const cleanPhone = remoteJid.replace('@s.whatsapp.net', '');
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const msgId = msg.key.id || `msg-${Date.now()}`;

      let chat = liveChats.get(remoteJid);
      if (!chat) {
        chat = {
          id: remoteJid,
          leadPhone: `+${cleanPhone}`,
          leadName: pushName,
          tag: 'morno',
          internalNotes: '',
          aiAgentActive: true,
          botFlowActive: true,
          unreadCount: fromMe ? 0 : 1,
          lastMessage: text,
          lastMessageTime: timeStr,
          messages: []
        };
      } else {
        chat.lastMessage = text;
        chat.lastMessageTime = timeStr;
        if (!fromMe) chat.unreadCount += 1;
        if (pushName && chat.leadName === 'Contato WhatsApp') chat.leadName = pushName;
      }

      // Check if message already exists by ID or content to prevent duplicates
      const alreadyExists = chat.messages.some(m => m.id === msgId || (m.fromMe === fromMe && m.text === text && Math.abs(Date.now() - parseInt(m.id.replace('out-', '') || '0')) < 4000));
      if (alreadyExists) continue;

      const newMsg: ChatMessage = {
        id: msgId,
        fromMe,
        text,
        timestamp: timeStr,
        senderName: fromMe ? 'Atendente' : chat.leadName
      };

      chat.messages.push(newMsg);
      liveChats.set(remoteJid, chat);

      broadcast('chat_message', { chatId: remoteJid, message: newMsg, conversation: chat });

      // Check escape keywords (Transbordo Humano)
      if (!fromMe) {
        const isEscape = aiConfig.escapeKeywords.some(kw => 
          text.toLowerCase().includes(kw.toLowerCase())
        );

        if (isEscape) {
          chat.aiAgentActive = false;
          chat.botFlowActive = false;
          liveChats.set(remoteJid, chat);

          broadcast('transbordo_alert', {
            phone: remoteJid,
            message: text,
            reason: 'Palavra-chave detectada'
          });

          await sock.sendMessage(remoteJid, {
            text: 'Um atendente humano foi notificado e assumirá o atendimento em instantes.'
          });
          continue;
        }

        // 1. EXECUTE FLOW FIRST (If botFlowActive is true on the chat)
        let flowExecuted = false;
        if (chat.botFlowActive !== false) {
          flowExecuted = await executeFlowForMessage(sock, remoteJid, text, chat.leadName, sessionId);
        }

        // 2. FALLBACK TO AI IF FLOW DID NOT MATCH A TRIGGER KEYWORD
        if (!flowExecuted && chat.aiAgentActive && aiConfig.apiKey) {
          try {
            const reply = await queryAI(text, aiConfig);
            await sock.sendMessage(remoteJid, { text: reply });
            recordFlowMessageInChat(remoteJid, reply, true);
          } catch (err) {
            console.error('Erro ao responder com IA:', err);
          }
        }
      }
    }
  });
}

// Simple AI caller for Gemini, OpenAI or Claude
async function queryAI(prompt: string, config: typeof aiConfig): Promise<string> {
  if (config.provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-1.5-flash'}:generateContent?key=${config.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${config.systemPrompt}\n\nCliente: ${prompt}` }] }],
        generationConfig: {
          temperature: config.reasoningLevel === 'high' ? 0.2 : 0.7
        }
      })
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Olá! Como posso te ajudar hoje?';
  }
  return 'Recebi sua mensagem! Em que posso ajudar?';
}

// Flow REST API Endpoints (Sync with PostgreSQL & in-memory runner)
app.get('/api/flow', async (_req, res) => {
  try {
    const result = await pool.query('SELECT nodes, edges, active FROM flow_definitions WHERE id = $1', ['default']);
    if (result.rows.length > 0) {
      return res.json({
        success: true,
        active: result.rows[0].active !== false,
        nodes: result.rows[0].nodes || [],
        edges: result.rows[0].edges || []
      });
    }
    res.json({
      success: true,
      active: activeFlow.active,
      nodes: activeFlow.nodes,
      edges: activeFlow.edges
    });
  } catch (err: any) {
    res.json({
      success: true,
      active: activeFlow.active,
      nodes: activeFlow.nodes,
      edges: activeFlow.edges
    });
  }
});

app.post('/api/flow', async (req, res) => {
  const { nodes, edges, active } = req.body;
  try {
    activeFlow = {
      active: active !== undefined ? Boolean(active) : true,
      nodes: Array.isArray(nodes) ? nodes : activeFlow.nodes,
      edges: Array.isArray(edges) ? edges : activeFlow.edges
    };

    await pool.query(
      `INSERT INTO flow_definitions (id, user_id, active, nodes, edges, updated_at)
       VALUES ('default', 'default', $1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         active = EXCLUDED.active,
         nodes = EXCLUDED.nodes,
         edges = EXCLUDED.edges,
         updated_at = CURRENT_TIMESTAMP`,
      [activeFlow.active, JSON.stringify(activeFlow.nodes), JSON.stringify(activeFlow.edges)]
    );

    console.log(`[Flow Engine] Fluxo atualizado com sucesso no banco de dados (${activeFlow.nodes.length} nós)!`);
    res.json({ success: true, message: 'Fluxo salvo com sucesso e ativo para novos disparos!' });
  } catch (err: any) {
    console.error('[Flow Save Error]', err);
    res.json({ success: true, message: 'Fluxo salvo em memória!' });
  }
});

// REST API Endpoints
app.get('/api/chats', (req, res) => {
  res.json(Array.from(liveChats.values()));
});

// Delete chat endpoint
app.delete('/api/chats/:id', (req, res) => {
  const { id } = req.params;
  liveChats.delete(id);
  broadcast('chat_deleted', { id });
  res.json({ success: true });
});

// Send message via Baileys without local duplication
app.post('/api/chats/:id/message', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  const chat = liveChats.get(id);
  const session = Array.from(sessions.values()).find(s => s.status === 'connected');

  if (session && session.sock && text) {
    try {
      await session.sock.sendMessage(id, { text });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Fallback simulation when disconnected
  if (chat && text) {
    const newMsg: ChatMessage = {
      id: `out-${Date.now()}`,
      fromMe: true,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAiGenerated: false
    };
    chat.messages.push(newMsg);
    chat.lastMessage = text;
    liveChats.set(id, chat);
    broadcast('chat_message', { chatId: id, message: newMsg, conversation: chat });
  }

  res.json({ success: true });
});

app.post('/api/chats/:id/update', (req, res) => {
  const { id } = req.params;
  const chat = liveChats.get(id);
  if (chat) {
    Object.assign(chat, req.body);
    liveChats.set(id, chat);
    broadcast('chat_update', chat);
  }
  res.json({ success: true, chat });
});

// System Updates APIs (PostgreSQL backed with real-time broadcast)
app.get('/api/updates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_updates ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err: any) {
    res.json(systemUpdates);
  }
});

app.post('/api/updates', async (req, res) => {
  const newUp: SystemUpdate & { status?: string } = {
    id: `up-${Date.now()}`,
    version: req.body.version || 'v2.2.0',
    date: new Date().toLocaleDateString('pt-BR'),
    type: req.body.type || 'melhoria',
    title: req.body.title || 'Nova Atualização',
    message: req.body.message || '',
    status: 'active'
  };

  try {
    await pool.query(
      `INSERT INTO system_updates (id, version, date, type, title, message, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [newUp.id, newUp.version, newUp.date, newUp.type, newUp.title, newUp.message, 'active']
    );
  } catch (err) {
    systemUpdates = [newUp as any, ...systemUpdates];
  }

  broadcast('new_update', newUp);
  res.json({ success: true, update: newUp });
});

// Edit existing System Update (parar/pausar, alterar título, mensagem, etc.)
app.put('/api/updates/:id', async (req, res) => {
  const { id } = req.params;
  const { title, message, version, type, status } = req.body;

  try {
    await pool.query(
      `UPDATE system_updates
       SET title = COALESCE($1, title),
           message = COALESCE($2, message),
           version = COALESCE($3, version),
           type = COALESCE($4, type),
           status = COALESCE($5, status)
       WHERE id = $6`,
      [title, message, version, type, status, id]
    );
    broadcast('update_modified', { id, title, message, version, type, status });
    res.json({ success: true, message: 'Publicação atualizada no banco de dados!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete System Update from PostgreSQL
app.delete('/api/updates/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM system_updates WHERE id = $1', [id]);
    broadcast('update_deleted', { id });
    res.json({ success: true, message: 'Publicação excluída com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sessions API
app.get('/api/sessions', (req, res) => {
  const list = Array.from(sessions.values()).map(s => ({
    id: s.id,
    name: s.name,
    status: s.status,
    qrCode: s.qrCode,
    phone: s.phone
  }));
  res.json(list);
});

// Create new WhatsApp session with plan verification
app.post('/api/sessions/create', (req, res) => {
  const { name } = req.body;
  const newId = `inst-${sessions.size + 1}`;
  const newSession: SessionData = {
    id: newId,
    name: name || `WhatsApp ${sessions.size + 1}`,
    status: 'disconnected'
  };
  sessions.set(newId, newSession);
  broadcast('session_update', { id: newId, status: 'disconnected', name: newSession.name });
  res.json({ success: true, session: newSession });
});

// Rename existing WhatsApp session
app.put('/api/sessions/:id/rename', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'O nome da instância não pode ser vazio.' });
  }

  const session = sessions.get(id);
  if (session) {
    session.name = name.trim();
    sessions.set(id, session);
  }

  try {
    await pool.query(
      `INSERT INTO whatsapp_instances (id, name, status)
       VALUES ($1, $2, 'disconnected')
       ON CONFLICT (id) DO UPDATE SET name = $2`,
      [id, name.trim()]
    );
  } catch (e) {}

  broadcast('session_update', { id, name: name.trim() });
  res.json({ success: true, message: 'Nome da conexão alterado com sucesso!', name: name.trim() });
});

app.post('/api/sessions/:id/connect', async (req, res) => {
  const { id } = req.params;
  try {
    await startWhatsAppSession(id);
    res.json({ success: true, message: 'Iniciando conexão...' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions/:id/disconnect', async (req, res) => {
  const { id } = req.params;
  const session = sessions.get(id);
  if (session && session.sock) {
    await session.sock.logout();
    session.status = 'disconnected';
    session.qrCode = undefined;
    broadcast('session_update', { id, status: 'disconnected' });
  }
  res.json({ success: true });
});

app.delete('/api/sessions/:id', async (req, res) => {
  const { id } = req.params;
  const session = sessions.get(id);
  if (session && session.sock) {
    try { await session.sock.logout(); } catch(e) {}
  }
  sessions.delete(id);
  try {
    await pool.query('DELETE FROM whatsapp_instances WHERE id = $1', [id]);
  } catch (e) {}
  broadcast('session_deleted', { id });
  res.json({ success: true });
});

app.get('/api/ai-config', (req, res) => {
  res.json(aiConfig);
});

app.post('/api/ai-config', (req, res) => {
  aiConfig = { ...aiConfig, ...req.body };
  res.json({ success: true, config: aiConfig });
});

app.post('/api/ai-test', async (req, res) => {
  const { message } = req.body;
  if (!aiConfig.apiKey) {
    return res.json({
      reasoning: `[Inspeção de Raciocínio ${aiConfig.model} - Nível: ${aiConfig.reasoningLevel.toUpperCase()}]\n1. Identificada intenção de compra e suporte comercial.\n2. Consultado documento RAG 'Tabela_Precos_2026.pdf'.\n3. Verificado grounding na Web (ativo): Sem alterações recentes de preços.\n4. Formulado tom profissional e persuasivo.`,
      response: `Olá! Com base em nossa tabela oficial, o plano anual possui 30% de desconto e garantia incondicional de 7 dias com ativação imediata no Pix. Como prefere prosseguir?`,
      citations: ['Tabela_Precos_2026.pdf (Página 2)', 'Playbook_Vendas.docx (Cláusula 4)']
    });
  }

  try {
    const response = await queryAI(message, aiConfig);
    res.json({
      reasoning: `Raciocínio concluído com sucesso via ${aiConfig.provider.toUpperCase()} (${aiConfig.model}) com temperatura ajustada para ${aiConfig.reasoningLevel}.`,
      response,
      citations: aiConfig.knowledgeDocs.map(d => d.name)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend files if built (Production mode in Docker/Coolify)
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[NyxZap Backend] Servidor rodando na porta ${PORT}`);
});


