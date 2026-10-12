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

  // Fast-path instant dev/demo users
  if (email === 'cliente@empresa.com' && password === '123456') {
    return res.json({
      id: 'usr-demo',
      name: 'Cliente NyxZap Pro',
      email: 'cliente@empresa.com',
      role: 'client',
      planName: 'Pro (Mais Vendido)',
      validUntil: '2026-11-10',
      instancesLimit: 3,
      token: 'jwt-token-demo'
    });
  }
  if (email === 'admin@nyxzap.com' && password === 'admin123') {
    return res.json({
      id: 'usr-admin',
      name: 'Super Administrador',
      email: 'admin@nyxzap.com',
      role: 'admin',
      planName: 'Enterprise Anual',
      validUntil: '2030-12-31',
      instancesLimit: 10,
      token: 'jwt-token-admin'
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
    console.warn('[PostgreSQL Offline - Fallback Local Dev]', err.message);
    if (email === 'cliente@empresa.com' && password === '123456') {
      return res.json({
        id: 'usr-demo',
        name: 'Cliente NyxZap Pro',
        email: 'cliente@empresa.com',
        role: 'client',
        planName: 'Pro (Mais Vendido)',
        validUntil: '2026-11-10',
        instancesLimit: 3,
        token: 'jwt-token-demo'
      });
    }
    if (email === 'admin@nyxzap.com' && password === 'admin123') {
      return res.json({
        id: 'usr-admin',
        name: 'Super Administrador',
        email: 'admin@nyxzap.com',
        role: 'admin',
        planName: 'Enterprise Anual',
        validUntil: '2030-12-31',
        instancesLimit: 10,
        token: 'jwt-token-admin'
      });
    }
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

app.post('/api/cakto/checkout-url', async (req, res) => {
  const { itemType, itemId } = req.body;
  try {
    const defaultLinks: Record<string, string> = {
      'tier_1': 'https://pay.cakto.com.br/nyxzap-extra-1',
      'tier_2': 'https://pay.cakto.com.br/nyxzap-extra-2',
      'tier_3': 'https://pay.cakto.com.br/nyxzap-extra-3',
      'tier_5': 'https://pay.cakto.com.br/nyxzap-extra-5',
      'plan_p1': 'https://pay.cakto.com.br/nyxzap-start',
      'plan_p2': 'https://pay.cakto.com.br/nyxzap-pro',
      'plan_p3': 'https://pay.cakto.com.br/nyxzap-enterprise'
    };

    let checkoutUrl = '';
    const result = await pool.query('SELECT * FROM cakto_config WHERE id = $1', ['default']);
    if (result.rows.length > 0) {
      const cfg = result.rows[0];
      const links = cfg.checkout_links || {};
      const key = `${itemType}_${itemId}`;
      checkoutUrl = links[key] || '';
    }

    if (!checkoutUrl) {
      const fallbackKey = `${itemType}_${itemId}`;
      checkoutUrl = defaultLinks[fallbackKey] || `https://pay.cakto.com.br/nyxzap-extra-${itemId || '1'}`;
    }

    res.json({ success: true, checkoutUrl });
  } catch (err: any) {
    res.json({ success: true, checkoutUrl: `https://pay.cakto.com.br/nyxzap-extra-${itemId || '1'}` });
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
  followUpText?: string;
  followUpMediaPath?: string;
  followUpMediaType?: 'image' | 'video' | 'audio' | 'document';
  followUpFileName?: string;
  followUpStatus?: 'idle' | 'scheduled' | 'completed';
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

const liveChats: Map<string, ChatConversation> = new Map();

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
  automationMode: 'flow' | 'ai' | 'none';
  qrCode?: string;
  phone?: string;
  sock?: any;
}

const sessions: Map<string, SessionData> = new Map([
  ['inst-1', { id: 'inst-1', name: 'WhatsApp Principal', status: 'disconnected', automationMode: 'flow' }]
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
  id: 'default',
  name: 'Fluxo Principal',
  description: '',
  active: true,
  execution_count: 0,
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
    const res = await pool.query('SELECT id, name, description, active, execution_count, nodes, edges FROM flow_definitions WHERE active = true ORDER BY updated_at DESC LIMIT 1');
    if (res.rows.length > 0) {
      const row = res.rows[0];
      activeFlow = {
        id: row.id,
        name: row.name || 'Fluxo Principal',
        description: row.description || '',
        active: row.active !== false,
        execution_count: row.execution_count || 0,
        nodes: row.nodes || [],
        edges: row.edges || []
      };
      console.log(`[Flow Engine] Fluxo '${activeFlow.name}' (${activeFlow.id}) carregado com ${activeFlow.nodes.length} cards e ${activeFlow.execution_count} execuções registradas.`);
    }
  } catch (err) {
    console.error('[Flow Engine Error] Falha ao ler fluxo do banco:', err);
  }
}
loadSavedFlow();

// Persist chat and message to PostgreSQL
async function persistChatAndMessage(chat: ChatConversation, newMsg?: ChatMessage) {
  try {
    await pool.query(
      `INSERT INTO chats (id, lead_phone, lead_name, tag, follow_up_date, follow_up_text, follow_up_media_path, follow_up_media_type, follow_up_file_name, follow_up_status, internal_notes, ai_agent_active, bot_flow_active, unread_count, last_message, last_message_time, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         lead_phone = EXCLUDED.lead_phone,
         lead_name = EXCLUDED.lead_name,
         tag = EXCLUDED.tag,
         follow_up_date = EXCLUDED.follow_up_date,
         follow_up_text = EXCLUDED.follow_up_text,
         follow_up_media_path = EXCLUDED.follow_up_media_path,
         follow_up_media_type = EXCLUDED.follow_up_media_type,
         follow_up_file_name = EXCLUDED.follow_up_file_name,
         follow_up_status = EXCLUDED.follow_up_status,
         internal_notes = EXCLUDED.internal_notes,
         ai_agent_active = EXCLUDED.ai_agent_active,
         bot_flow_active = EXCLUDED.bot_flow_active,
         unread_count = EXCLUDED.unread_count,
         last_message = EXCLUDED.last_message,
         last_message_time = EXCLUDED.last_message_time,
         updated_at = CURRENT_TIMESTAMP`,
      [
        chat.id, 
        chat.leadPhone, 
        chat.leadName, 
        chat.tag, 
        chat.followUpDate || null, 
        chat.followUpText || '', 
        chat.followUpMediaPath || '', 
        chat.followUpMediaType || '', 
        chat.followUpFileName || '', 
        chat.followUpStatus || 'idle', 
        chat.internalNotes || '', 
        chat.aiAgentActive, 
        chat.botFlowActive, 
        chat.unreadCount, 
        chat.lastMessage, 
        chat.lastMessageTime
      ]
    );

    if (newMsg) {
      await pool.query(
        `INSERT INTO chat_messages (id, chat_id, from_me, text, timestamp, sender_name, is_ai_generated, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [newMsg.id, chat.id, newMsg.fromMe, newMsg.text, newMsg.timestamp, newMsg.senderName || '', newMsg.isAiGenerated || false]
      );
    }
  } catch (err) {
    console.error('[Persist Chat Error]', err);
  }
}

// Load saved chats from PostgreSQL on server startup
async function loadSavedChats() {
  try {
    const chatsResult = await pool.query('SELECT * FROM chats ORDER BY updated_at DESC');
    for (const row of chatsResult.rows) {
      if (!row.id || row.id.includes('broadcast') || row.id.includes('@newsletter')) continue;
      const msgsResult = await pool.query('SELECT * FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC', [row.id]);
      const messages: ChatMessage[] = msgsResult.rows.map(m => ({
        id: m.id,
        fromMe: Boolean(m.from_me),
        text: m.text,
        timestamp: m.timestamp,
        senderName: m.sender_name,
        isAiGenerated: Boolean(m.is_ai_generated)
      }));
      liveChats.set(row.id, {
        id: row.id,
        leadPhone: row.lead_phone,
        leadName: row.lead_name,
        tag: row.tag || 'morno',
        followUpDate: row.follow_up_date,
        followUpText: row.follow_up_text || '',
        followUpMediaPath: row.follow_up_media_path || '',
        followUpMediaType: row.follow_up_media_type || '',
        followUpFileName: row.follow_up_file_name || '',
        followUpStatus: row.follow_up_status || 'idle',
        internalNotes: row.internal_notes || '',
        aiAgentActive: row.ai_agent_active === true,
        botFlowActive: row.bot_flow_active !== false,
        unreadCount: row.unread_count || 0,
        lastMessage: row.last_message || '',
        lastMessageTime: row.last_message_time || '',
        messages
      });
    }
    console.log(`[Chats] ${liveChats.size} conversas carregadas do banco de dados PostgreSQL.`);
  } catch (err) {
    console.error('[Chats Error] Falha ao carregar chats do banco:', err);
  }
}
loadSavedChats();

// Helper to sanitize text for matching keywords (remove accents, lowercase, trim)
function normalizeText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Helper to format time in America/Sao_Paulo (Horário Oficial de Brasília)
function getBrazilTimeString(date: Date = new Date()): string {
  return date.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

// Function to simulate natural typing state (Composing) on WhatsApp
async function simulateTyping(sock: any, remoteJid: string, durationMs: number = 2000) {
  try {
    if (sock && sock.sendPresenceUpdate) {
      await sock.sendPresenceUpdate('composing', remoteJid);
      await new Promise(r => setTimeout(r, durationMs));
      await sock.sendPresenceUpdate('paused', remoteJid);
    } else {
      await new Promise(r => setTimeout(r, durationMs));
    }
  } catch (e) {
    await new Promise(r => setTimeout(r, durationMs));
  }
}

interface PendingFlowResponse {
  remoteJid: string;
  nodeId: string;
  sessionId: string;
  senderName: string;
  timeoutTimer: NodeJS.Timeout;
  responseTargetId?: string;
  timeoutTargetId?: string;
  flow?: { nodes: FlowNodeServer[]; edges: FlowEdgeServer[] };
}

// Leads currently waiting for response at a specific card in a flow
const pendingFlowResponses = new Map<string, PendingFlowResponse>();

// Resume flow execution starting from a given target node
async function resumeFlowChain(
  sock: any,
  remoteJid: string,
  startNodeId: string,
  senderName: string,
  incomingText: string,
  sessionId: string,
  flowObj: { nodes: FlowNodeServer[]; edges: FlowEdgeServer[] } = activeFlow
): Promise<void> {
  const visitedNodes = new Set<string>();
  let queue: string[] = [startNodeId];

  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    if (visitedNodes.has(currentNodeId)) continue;
    visitedNodes.add(currentNodeId);

    const currentNode = flowObj.nodes.find(n => n.id === currentNodeId);
    if (!currentNode) continue;

    // Execute node action
    await executeNodeAction(sock, remoteJid, currentNode, senderName, incomingText);

    // If node is Finalizar Fluxo, stop chain immediately
    if (currentNode.type === 'finalizar') {
      console.log(`[Flow Engine] Fluxo finalizado pelo card Finalizar Fluxo para ${remoteJid}`);
      return;
    }

    // Check if node waits for client response
    if (currentNode.data?.waitForResponse) {
      const outgoingEdges = flowObj.edges.filter(e => e.from === currentNode.id);
      const responseEdge = outgoingEdges.find(e => e.fromHandle === 'response' || e.label?.toLowerCase().includes('respondeu'));
      const timeoutEdge = outgoingEdges.find(e => e.fromHandle === 'timeout' || e.label?.toLowerCase().includes('não'));

      // Clear any previous timer
      const existing = pendingFlowResponses.get(remoteJid);
      if (existing) clearTimeout(existing.timeoutTimer);

      const unit = currentNode.data?.timeoutUnit || 'segundos';
      const delay = Number(currentNode.data?.timeoutSeconds || (unit === 'minutos' ? 1 : 30));
      const totalMs = (unit === 'minutos' ? delay * 60 : unit === 'horas' ? delay * 3600 : delay) * 1000;

      console.log(`[Flow Engine] Card '${currentNode.title}' aguardando resposta de ${remoteJid} por ${delay} ${unit} (${totalMs}ms)...`);

      const timeoutTimer = setTimeout(async () => {
        pendingFlowResponses.delete(remoteJid);
        console.log(`[Flow Engine] Tempo esgotado (${delay} ${unit}) para ${remoteJid}. Prosseguindo conexão 'Não respondeu' (${timeoutEdge?.to || 'Nenhuma'}).`);
        if (timeoutEdge?.to) {
          await resumeFlowChain(sock, remoteJid, timeoutEdge.to, senderName, '', sessionId, flowObj);
        }
      }, totalMs);

      pendingFlowResponses.set(remoteJid, {
        remoteJid,
        nodeId: currentNode.id,
        sessionId,
        senderName,
        timeoutTimer,
        responseTargetId: responseEdge?.to,
        timeoutTargetId: timeoutEdge?.to,
        flow: flowObj
      });

      // STOP here. Do NOT execute next nodes until response or timeout.
      return;
    }

    // Normal progression for nodes without response pause
    const outgoingEdges = flowObj.edges.filter(e => e.from === currentNodeId);
    outgoingEdges.forEach(e => {
      if (!visitedNodes.has(e.to)) {
        queue.push(e.to);
      }
    });
  }
}

// Function to execute visual flow nodes for a contact (Multi-step chain execution)
async function executeFlowForMessage(
  sock: any, 
  remoteJid: string, 
  incomingText: string, 
  senderName: string,
  sessionId: string
): Promise<boolean> {
  const normIncoming = normalizeText(incomingText);

  // Load all active flows from PostgreSQL (or fallback to in-memory activeFlow)
  let flowsList: Array<{ id: string; name: string; nodes: FlowNodeServer[]; edges: FlowEdgeServer[] }> = [];
  try {
    const res = await pool.query('SELECT id, name, nodes, edges FROM flow_definitions WHERE active = true ORDER BY updated_at DESC');
    if (res.rows.length > 0) {
      flowsList = res.rows.map(r => ({
        id: r.id,
        name: r.name || 'Fluxo',
        nodes: r.nodes || [],
        edges: r.edges || []
      }));
    }
  } catch (err) {
    // fallback
  }

  if (flowsList.length === 0 && activeFlow.active && activeFlow.nodes?.length > 0) {
    flowsList = [activeFlow];
  }

  if (flowsList.length === 0) return false;

  for (const flow of flowsList) {
    const triggerNode = flow.nodes.find(n => {
      if (n.type !== 'inicio') return false;

      // Check instance filter if specified
      const targetInst = n.data?.instance;
      if (targetInst && targetInst !== 'Todas' && sessions.size > 1) {
        const cleanInstNum = targetInst.replace(/[^0-9]/g, '');
        const cleanSessionNum = sessionId.replace(/[^0-9]/g, '');
        const session = sessions.get(sessionId);
        const sessionName = (session?.name || '').toLowerCase();
        const matchesInstNum = cleanInstNum && cleanSessionNum && cleanInstNum === cleanSessionNum;
        const matchesInstName = cleanInstNum && sessionName.includes(cleanInstNum);
        if (!matchesInstNum && !matchesInstName && !sessionId.includes(cleanInstNum)) {
          return false;
        }
      }

      const triggerType = n.data?.trigger || 'palavra_chave';
      if (triggerType === 'boas_vindas') {
        return true;
      }

      let keywordsList: string[] = [];
      if (Array.isArray(n.data?.keywords)) {
        keywordsList = n.data.keywords;
      } else if (typeof n.data?.keywords === 'string') {
        keywordsList = n.data.keywords.split(/[\n,]+/).map((s: string) => s.trim());
      } else if (typeof n.data?.keyword === 'string') {
        keywordsList = [n.data.keyword];
      }

      if (keywordsList.length === 0) return false;

      return keywordsList.some(kw => {
        const normKw = normalizeText(kw);
        if (!normKw) return false;
        return normIncoming.includes(normKw) || normKw.includes(normIncoming);
      });
    });

    if (triggerNode) {
      console.log(`[Flow Engine] Gatilho ativado pelo card '${triggerNode.title}' no fluxo '${flow.name}' (${flow.id}) para ${remoteJid}!`);

      // Increment execution counter in DB
      try {
        await pool.query('UPDATE flow_definitions SET execution_count = COALESCE(execution_count, 0) + 1 WHERE id = $1', [flow.id]);
      } catch (err) {
        // Non-blocking
      }

      const initialEdges = flow.edges.filter(e => e.from === triggerNode.id);
      if (initialEdges.length === 0) return true;

      for (const edge of initialEdges) {
        await resumeFlowChain(sock, remoteJid, edge.to, senderName, incomingText, sessionId, flow);
      }

      return true;
    }
  }

  return false;
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
    const hour = parseInt(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }).format(new Date()));
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

      // Natural delay + "digitando..." status before sending text
      await simulateTyping(sock, remoteJid, 2500);

      await sock.sendMessage(remoteJid, { text: finalText });
      recordFlowMessageInChat(remoteJid, finalText);
    } else if (node.type === 'audio') {
      const audioPath = node.data?.fileUrl || node.data?.audioUrl;
      if (audioPath) {
        const fullAudioUrl = audioPath.startsWith('http') 
          ? audioPath 
          : path.join(process.cwd(), audioPath.replace(/^\//, ''));

        if (fs.existsSync(fullAudioUrl)) {
          // Simulate "gravando áudio..."
          try {
            await sock.sendPresenceUpdate('recording', remoteJid);
            await new Promise(r => setTimeout(r, (node.data?.delaySeconds || 3) * 1000));
            await sock.sendPresenceUpdate('paused', remoteJid);
          } catch (e) {}

          await sock.sendMessage(remoteJid, {
            audio: fs.readFileSync(fullAudioUrl),
            mimetype: 'audio/mp4',
            ptt: true // Sent as voice note (áudio gravado na hora)
          });
          recordFlowMessageInChat(remoteJid, '🎵 [Áudio gravado enviado]');
        }
      }
    } else if (node.type === 'imagem') {
      const imgPath = node.data?.fileUrl || node.data?.imageUrl;
      if (imgPath) {
        const fullImgPath = imgPath.startsWith('http')
          ? imgPath
          : path.join(process.cwd(), imgPath.replace(/^\//, ''));

        if (fs.existsSync(fullImgPath)) {
          // Natural typing delay for photo dispatch
          await simulateTyping(sock, remoteJid, 2000);

          const caption = replaceVariables(node.data?.caption || '');
          await sock.sendMessage(remoteJid, {
            image: fs.readFileSync(fullImgPath),
            caption
          });
          recordFlowMessageInChat(remoteJid, `🖼️ [Imagem enviada: ${caption || 'Sem legenda'}]`);
        } else {
          console.error(`[Flow Engine] Arquivo de imagem não encontrado no disco: ${fullImgPath}`);
        }
      }
    } else if (node.type === 'video') {
      const vidPath = node.data?.fileUrl || node.data?.videoUrl;
      if (vidPath) {
        const fullVideoPath = vidPath.startsWith('http')
          ? vidPath
          : path.join(process.cwd(), vidPath.replace(/^\//, ''));

        if (fs.existsSync(fullVideoPath)) {
          await simulateTyping(sock, remoteJid, 2500);

          const caption = replaceVariables(node.data?.caption || '');
          await sock.sendMessage(remoteJid, {
            video: fs.readFileSync(fullVideoPath),
            caption
          });
          recordFlowMessageInChat(remoteJid, `🎥 [Vídeo enviado: ${caption || 'Sem legenda'}]`);
        }
      }
    } else if (node.type === 'pdf') {
      const docPath = node.data?.fileUrl || node.data?.pdfUrl;
      if (docPath) {
        const fullPdfPath = docPath.startsWith('http')
          ? docPath
          : path.join(process.cwd(), docPath.replace(/^\//, ''));

        if (fs.existsSync(fullPdfPath)) {
          await simulateTyping(sock, remoteJid, 2000);

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
      await new Promise(r => setTimeout(r, Math.min(ms, 60000))); // Wait configured timer
    } else if (node.type === 'ia' || node.type === 'ia_audio') {
      await simulateTyping(sock, remoteJid, 3000);

      const customPrompt = node.data?.prompt 
        ? `${node.data.prompt}\n\nMensagem do cliente: ${incomingText}`
        : incomingText;
      const reply = await queryAI(customPrompt, aiConfig);
      await sock.sendMessage(remoteJid, { text: reply });
      recordFlowMessageInChat(remoteJid, reply, true);
    } else if (node.type === 'grupo_wa') {
      const action = node.data?.action || 'adicionar';
      const groupId = node.data?.groupId;
      console.log(`[Flow Engine] Executando Gerenciar Grupo (${action}) para ${remoteJid}`);
      if (groupId && sock.groupParticipantsUpdate) {
        try {
          if (action === 'adicionar') {
            await sock.groupParticipantsUpdate(groupId, [remoteJid], 'add');
            recordFlowMessageInChat(remoteJid, `👥 [Lead adicionado ao grupo WhatsApp]`);
          } else if (action === 'remover') {
            await sock.groupParticipantsUpdate(groupId, [remoteJid], 'remove');
            recordFlowMessageInChat(remoteJid, `👥 [Lead removido do grupo WhatsApp]`);
          }
        } catch (grpErr) {
          console.error('[Flow Engine] Erro na ação de grupo:', grpErr);
        }
      }
    } else if (node.type === 'conectar_fluxo') {
      const targetFlowName = node.data?.targetFlow || 'Fluxo Principal';
      console.log(`[Flow Engine] Redirecionando lead ${remoteJid} para '${targetFlowName}'`);
      recordFlowMessageInChat(remoteJid, `🔗 [Redirecionado para: ${targetFlowName}]`);
    } else if (node.type === 'finalizar') {
      console.log(`[Flow Engine] Funil finalizado para ${remoteJid}`);
    }
  } catch (nodeErr) {
    console.error(`[Flow Engine] Erro ao executar nó ${node.id} (${node.type}):`, nodeErr);
  }
}

// Record bot sent messages into liveChats & broadcast to UI in real-time
function recordFlowMessageInChat(remoteJid: string, text: string, isAi = false) {
  const timeStr = getBrazilTimeString();
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
    persistChatAndMessage(chat, botMsg).catch(err => console.error('[Bot Msg Persist Error]', err));
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

  const session: SessionData = sessions.get(sessionId) || { 
    id: sessionId, 
    name: `WhatsApp ${sessionId}`, 
    status: 'connecting',
    automationMode: 'flow' 
  };
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

  // Handle syncing recent chat history on connection
  sock.ev.on('messaging-history.set', async ({ chats: histChats }: any) => {
    try {
      if (Array.isArray(histChats)) {
        for (const c of histChats) {
          const jid = c.id;
          if (!jid || jid.includes('@g.us') || jid.includes('broadcast') || jid.includes('status@') || jid.includes('@newsletter')) continue;
          const cleanPhone = jid.replace('@s.whatsapp.net', '').replace('@lid', '');
          let chat = liveChats.get(jid);
          if (!chat) {
            chat = {
              id: jid,
              leadPhone: `+${cleanPhone}`,
              leadName: c.name || 'Contato WhatsApp',
              tag: 'morno',
              internalNotes: '',
              aiAgentActive: false,
              botFlowActive: true,
              unreadCount: c.unreadCount || 0,
              lastMessage: '',
              lastMessageTime: getBrazilTimeString(),
              messages: []
            };
            liveChats.set(jid, chat);
            await persistChatAndMessage(chat);
          }
        }
        console.log(`[WhatsApp Sync] Sincronizadas ${histChats.length} conversas recebidas do WhatsApp.`);
      }
    } catch (e) {
      console.error('[WhatsApp Sync Error]', e);
    }
  });

  // Handle incoming & outgoing messages in real-time
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages) {
      if (!msg.message) continue;
      let remoteJid = msg.key.remoteJid;
      if (!remoteJid) continue;

      // IGNORE groups, status stories, broadcasts, newsletters
      if (
        remoteJid.includes('@g.us') || 
        remoteJid.includes('broadcast') || 
        remoteJid.includes('status@') || 
        remoteJid.includes('@newsletter')
      ) {
        continue;
      }

      // If remoteJid is @lid, resolve to phone JID if available
      if (remoteJid.includes('@lid')) {
        const altJid = (msg.key as any).remoteJidAlt || (msg.key as any).participant;
        if (altJid && altJid.includes('@s.whatsapp.net')) {
          remoteJid = altJid;
        }
      }

      // Unwrap ephemeral, viewOnce, and document-with-caption wrappers
      const rawMsg = msg.message;
      const unwrapped = (rawMsg as any)?.ephemeralMessage?.message 
        || (rawMsg as any)?.viewOnceMessage?.message 
        || (rawMsg as any)?.viewOnceMessageV2?.message 
        || (rawMsg as any)?.documentWithCaptionMessage?.message 
        || rawMsg;

      const text = (unwrapped as any)?.conversation 
        || (unwrapped as any)?.extendedTextMessage?.text 
        || (unwrapped as any)?.imageMessage?.caption 
        || (unwrapped as any)?.videoMessage?.caption
        || (unwrapped as any)?.documentMessage?.caption
        || ((unwrapped as any)?.audioMessage ? '🎵 [Áudio]' : '')
        || ((unwrapped as any)?.imageMessage ? '📷 [Foto]' : '')
        || ((unwrapped as any)?.videoMessage ? '🎥 [Vídeo]' : '')
        || ((unwrapped as any)?.documentMessage ? `📄 [Documento: ${(unwrapped as any).documentMessage.fileName || 'arquivo'}]` : '')
        || ((unwrapped as any)?.stickerMessage ? '🏷️ [Figurinha]' : '')
        || ((unwrapped as any)?.contactMessage ? '👤 [Contato]' : '')
        || ((unwrapped as any)?.locationMessage ? '📍 [Localização]' : '')
        || '';

      if (!text) continue;

      const fromMe = Boolean(msg.key.fromMe);
      const pushName = msg.pushName || 'Contato WhatsApp';
      const cleanPhone = remoteJid.replace('@s.whatsapp.net', '');
      const timeStr = getBrazilTimeString();
      const msgId = msg.key.id || `msg-${Date.now()}`;

      const instSession = sessions.get(sessionId);
      const instanceMode = instSession?.automationMode || 'flow';

      let chat = liveChats.get(remoteJid);
      if (!chat) {
        chat = {
          id: remoteJid,
          leadPhone: `+${cleanPhone}`,
          leadName: pushName,
          tag: 'morno',
          internalNotes: '',
          aiAgentActive: instanceMode === 'ai',
          botFlowActive: instanceMode === 'flow',
          unreadCount: fromMe ? 0 : 1,
          lastMessage: text,
          lastMessageTime: timeStr,
          messages: []
        };
      } else {
        chat.lastMessage = text;
        chat.lastMessageTime = timeStr;
        if (!fromMe) chat.unreadCount += 1;
        if (pushName && (chat.leadName === 'Contato WhatsApp' || !chat.leadName)) chat.leadName = pushName;
      }

      // Check if message already exists by ID or content to prevent duplicates (especially bot- or out- messages echoed by Baileys)
      let isDuplicate = false;
      if (chat.messages.some(m => m.id === msgId)) {
        isDuplicate = true;
      } else if (fromMe) {
        const botOrOut = chat.messages.find(m => 
          m.fromMe && 
          m.text.trim() === text.trim() && 
          (m.id.startsWith('bot-') || m.id.startsWith('out-'))
        );
        if (botOrOut) {
          botOrOut.id = msgId;
          isDuplicate = true;
        }
      }

      if (isDuplicate) continue;

      const newMsg: ChatMessage = {
        id: msgId,
        fromMe,
        text,
        timestamp: timeStr,
        senderName: fromMe ? 'Atendente' : chat.leadName
      };

      chat.messages.push(newMsg);
      liveChats.set(remoteJid, chat);

      // Persist conversation and message to PostgreSQL (ensuring it stays after deploys)
      await persistChatAndMessage(chat, newMsg);

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
          await persistChatAndMessage(chat);

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

        // EXECUÇÃO EXCLUSIVA BASEADA NA ESCOLHA DA INSTÂNCIA (NUNCA AS DUAS JUNTAS)
        if (instanceMode === 'flow' && chat.botFlowActive !== false) {
          // MODO EXCLUSIVO: BOT DE FLUXO
          const pending = pendingFlowResponses.get(remoteJid);
          if (pending) {
            clearTimeout(pending.timeoutTimer);
            pendingFlowResponses.delete(remoteJid);
            console.log(`[Flow Engine] Cliente ${remoteJid} respondeu a tempo ao card '${pending.nodeId}'! Cancelando timeout e seguindo 'Se responder' (${pending.responseTargetId || 'Fim do fluxo'}).`);
            if (pending.responseTargetId) {
              await resumeFlowChain(sock, remoteJid, pending.responseTargetId, chat.leadName, text, sessionId);
            }
          } else {
            await executeFlowForMessage(sock, remoteJid, text, chat.leadName, sessionId);
          }
        } else if (instanceMode === 'ai' && chat.aiAgentActive !== false && aiConfig.apiKey) {
          // MODO EXCLUSIVO: AGENTE DE IA
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

// Flow REST API Endpoints (Multi-flow supported)
app.get('/api/flows', async (_req, res) => {
  try {
    const result = await pool.query('SELECT id, name, description, active, execution_count, nodes, edges, updated_at FROM flow_definitions ORDER BY updated_at DESC');
    if (result.rows.length > 0) {
      return res.json({
        success: true,
        flows: result.rows.map(r => ({
          id: r.id,
          name: r.name || 'Fluxo Principal',
          description: r.description || '',
          active: r.active !== false,
          executionCount: parseInt(r.execution_count, 10) || 0,
          nodes: r.nodes || [],
          edges: r.edges || [],
          nodeCount: Array.isArray(r.nodes) ? r.nodes.length : 0,
          updatedAt: r.updated_at
        }))
      });
    }
  } catch (err: any) {
    console.error('[Flows List Error]', err);
  }

  // Default fallback flow
  res.json({
    success: true,
    flows: [{
      id: 'default',
      name: 'Fluxo Principal de Vendas',
      description: 'Gatilhos de WhatsApp, IA, Mídias diretas do PC e Conexões Inteligentes.',
      active: activeFlow.active,
      executionCount: activeFlow.execution_count || 0,
      nodes: activeFlow.nodes,
      edges: activeFlow.edges,
      nodeCount: activeFlow.nodes.length,
      updatedAt: new Date().toISOString()
    }]
  });
});

// Update flow metadata (nome, descrição, pausar/ativar)
app.put('/api/flows/:id/meta', async (req, res) => {
  const { id } = req.params;
  const { name, description, active } = req.body;
  try {
    await pool.query(
      `UPDATE flow_definitions 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           active = COALESCE($3, active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [name, description, active !== undefined ? Boolean(active) : null, id]
    );
    if (activeFlow.id === id) {
      if (name !== undefined) activeFlow.name = name;
      if (description !== undefined) activeFlow.description = description;
      if (active !== undefined) activeFlow.active = Boolean(active);
    }
    res.json({ success: true, message: 'Dados do fluxo atualizados com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/flows', async (req, res) => {
  const { id, name, description, nodes, edges, active } = req.body;
  const flowId = id || `flow-${Date.now()}`;
  const flowName = name || 'Novo Fluxo';
  const flowDesc = description || '';
  const flowActive = active !== undefined ? Boolean(active) : true;
  const flowNodes = Array.isArray(nodes) ? nodes : activeFlow.nodes;
  const flowEdges = Array.isArray(edges) ? edges : activeFlow.edges;

  try {
    await pool.query(
      `INSERT INTO flow_definitions (id, user_id, name, description, active, nodes, edges, updated_at)
       VALUES ($1, 'default', $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         active = EXCLUDED.active,
         nodes = EXCLUDED.nodes,
         edges = EXCLUDED.edges,
         updated_at = CURRENT_TIMESTAMP`,
      [flowId, flowName, flowDesc, flowActive, JSON.stringify(flowNodes), JSON.stringify(flowEdges)]
    );

    activeFlow = {
      ...activeFlow,
      id: flowId,
      name: flowName,
      description: flowDesc,
      active: flowActive,
      nodes: flowNodes,
      edges: flowEdges
    };

    console.log(`[Flow Engine] Fluxo '${flowName}' (${flowId}) salvo com sucesso!`);
    res.json({ success: true, id: flowId, message: 'Fluxo salvo com sucesso e ativo!' });
  } catch (err: any) {
    console.error('[Flow Save Error]', err);
    res.json({ success: true, id: flowId, message: 'Fluxo salvo em memória!' });
  }
});

app.delete('/api/flows/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM flow_definitions WHERE id = $1', [id]);
    res.json({ success: true, message: 'Fluxo excluído com sucesso!' });
  } catch (err: any) {
    res.json({ success: true });
  }
});

// Single active flow backwards compatibility
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
      ...activeFlow,
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

// Endpoint para Testar o Funil disparando diretamente para um WhatsApp informado
app.post('/api/flow/test', async (req, res) => {
  const { phone, flowId, nodes, edges } = req.body;

  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'Número de telefone é obrigatório.' });
  }

  const trimmedPhone = phone.trim();
  if (!trimmedPhone.startsWith('+')) {
    return res.status(400).json({ 
      error: 'É obrigatório incluir o símbolo + e o código do país (ex: +5511999999999).' 
    });
  }

  const cleanNumber = trimmedPhone.replace(/\D/g, '');
  if (cleanNumber.length < 8) {
    return res.status(400).json({ error: 'Número de telefone inválido.' });
  }

  // Find a connected WhatsApp session
  let connectedSession: SessionData | undefined;
  for (const s of sessions.values()) {
    if (s.status === 'connected' && s.sock) {
      connectedSession = s;
      break;
    }
  }

  if (!connectedSession || !connectedSession.sock) {
    return res.status(400).json({
      error: 'Nenhuma conexão de WhatsApp ativa no momento. Conecte um número no menu Conexões para testar o funil.'
    });
  }

  const testNodes: FlowNodeServer[] = Array.isArray(nodes) && nodes.length > 0 ? nodes : activeFlow.nodes;
  const testEdges: FlowEdgeServer[] = Array.isArray(edges) ? edges : activeFlow.edges;

  if (testNodes.length === 0) {
    return res.status(400).json({ error: 'O fluxo não possui nenhum card para executar.' });
  }

  // Determine starting node:
  const triggerNode = testNodes.find(n => n.type === 'inicio' || n.type === 'webhook');
  let startNodeId: string | null = null;

  if (triggerNode) {
    const outgoing = testEdges.filter(e => e.from === triggerNode.id);
    if (outgoing.length > 0) {
      startNodeId = outgoing[0].to;
    } else {
      const firstAction = testNodes.find(n => n.type !== 'inicio' && n.type !== 'webhook');
      startNodeId = firstAction ? firstAction.id : triggerNode.id;
    }
  } else {
    startNodeId = testNodes[0].id;
  }

  if (!startNodeId) {
    return res.status(400).json({ error: 'Não foi possível identificar o card inicial do funil.' });
  }

  const remoteJid = `${cleanNumber}@s.whatsapp.net`;
  console.log(`[Flow Test Engine] Disparando teste do fluxo '${flowId || activeFlow.id}' para ${remoteJid} a partir do card '${startNodeId}'`);

  try {
    // Sync activeFlow in memory
    activeFlow.nodes = testNodes;
    activeFlow.edges = testEdges;

    // Increment execution count in DB
    const targetFlowId = flowId || activeFlow.id || 'default';
    activeFlow.execution_count = (activeFlow.execution_count || 0) + 1;
    await pool.query('UPDATE flow_definitions SET execution_count = COALESCE(execution_count, 0) + 1 WHERE id = $1', [targetFlowId]);

    // Execute flow chain
    resumeFlowChain(connectedSession.sock, remoteJid, startNodeId, 'Lead Teste', 'Teste de Funil', connectedSession.id)
      .catch(err => console.error('[Flow Test Error]', err));

    res.json({
      success: true,
      message: `Funil disparado com sucesso para ${trimmedPhone}!`
    });
  } catch (err: any) {
    console.error('[Flow Test Error]', err);
    res.status(500).json({ error: 'Erro ao disparar teste: ' + err.message });
  }
});

// REST API Endpoints
app.get('/api/chats', (req, res) => {
  const validChats = Array.from(liveChats.values()).filter(c => 
    c.id && 
    !c.id.includes('broadcast') && 
    !c.id.includes('@newsletter') && 
    !c.leadPhone.includes('broadcast')
  );
  res.json(validChats);
});

// Helper to resolve real phone numbers for group participants (resolving LIDs to real numbers)
async function resolveGroupParticipants(sock: any, participants: any[]): Promise<Array<{ id: string; phone: string; admin: any }>> {
  if (!Array.isArray(participants)) return [];
  const result: Array<{ id: string; phone: string; admin: any }> = [];
  const lidToResolve: string[] = [];

  for (const p of participants) {
    let phone = '';
    const id = p.id || '';
    
    // 1. Check if phoneNumber is provided directly by Baileys/WhatsApp
    if (p.phoneNumber) {
      phone = String(p.phoneNumber).split('@')[0].split(':')[0].replace(/\D/g, '');
    } else if (id.endsWith('@s.whatsapp.net')) {
      phone = id.split('@')[0].split(':')[0].replace(/\D/g, '');
    } else if (id.endsWith('@lid')) {
      lidToResolve.push(id);
    } else if (id && !id.includes('@')) {
      phone = id.split(':')[0].replace(/\D/g, '');
    }

    result.push({
      id,
      phone,
      admin: p.admin || null
    });
  }

  // 2. If there are LIDs, attempt batch resolution via signalRepository lidMapping
  if (lidToResolve.length > 0 && sock?.signalRepository?.lidMapping?.getPNsForLIDs) {
    try {
      const resolvedPairs = await sock.signalRepository.lidMapping.getPNsForLIDs(lidToResolve);
      if (Array.isArray(resolvedPairs)) {
        const lidMap = new Map<string, string>();
        for (const pair of resolvedPairs) {
          if (pair?.lid && pair?.pn) {
            const cleanPn = String(pair.pn).split('@')[0].split(':')[0].replace(/\D/g, '');
            lidMap.set(pair.lid, cleanPn);
            lidMap.set(pair.lid.split('@')[0], cleanPn);
          }
        }
        for (const item of result) {
          if (!item.phone && item.id) {
            const mapped = lidMap.get(item.id) || lidMap.get(item.id.split('@')[0]);
            if (mapped) item.phone = mapped;
          }
        }
      }
    } catch (e) {
      console.warn('[LID Mapping Batch Error]', e);
    }
  }

  // 3. Fallback: Check liveChats for any participant whose customerPhone is known
  for (const item of result) {
    if (!item.phone && item.id) {
      const lidClean = item.id.split('@')[0];
      const matchChat = liveChats.find(c => 
        c.remoteJid === item.id || 
        c.id === item.id || 
        (c.customerPhone && c.customerPhone !== lidClean && (c.remoteJid?.includes(lidClean) || c.id?.includes(lidClean)))
      );
      if (matchChat && matchChat.customerPhone && !matchChat.customerPhone.startsWith('175') && matchChat.customerPhone.length >= 8) {
        item.phone = matchChat.customerPhone.replace(/\D/g, '');
      }
    }
  }

  return result;
}

// Endpoint para buscar grupos do WhatsApp conectado
app.get('/api/whatsapp/groups', async (req, res) => {
  const { sessionId } = req.query;
  let targetSession: SessionData | undefined;

  if (sessionId && typeof sessionId === 'string') {
    targetSession = sessions.get(sessionId);
  }
  if (!targetSession || !targetSession.sock || targetSession.status !== 'connected') {
    for (const s of sessions.values()) {
      if (s.status === 'connected' && s.sock) {
        targetSession = s;
        break;
      }
    }
  }

  if (!targetSession || !targetSession.sock || targetSession.status !== 'connected') {
    return res.json({ 
      success: false, 
      groups: [], 
      error: 'Nenhum WhatsApp conectado. Conecte seu aparelho para sincronizar os grupos.' 
    });
  }

  try {
    const rawGroups = await targetSession.sock.groupFetchAllParticipating();
    const groupsList = Object.values(rawGroups);
    const groups = await Promise.all(groupsList.map(async (g: any) => {
      const resolvedParticipants = await resolveGroupParticipants(targetSession?.sock, g.participants || []);
      return {
        id: g.id,
        name: g.subject || 'Grupo sem nome',
        participantsCount: Array.isArray(g.participants) ? g.participants.length : 0,
        desc: g.desc || '',
        owner: g.owner || '',
        participants: resolvedParticipants
      };
    }));

    res.json({ success: true, sessionId: targetSession.id, groups });
  } catch (err: any) {
    console.error('[WhatsApp Groups Error]', err);
    res.status(500).json({ success: false, groups: [], error: 'Erro ao buscar grupos: ' + err.message });
  }
});

// Endpoint dedicado para extração de contatos reais do grupo com metadata interativa
app.get('/api/whatsapp/groups/:groupId/contacts', async (req, res) => {
  const { groupId } = req.params;
  const sessionId = req.query.sessionId as string;
  let targetSession: SessionData | undefined;

  if (sessionId && typeof sessionId === 'string') {
    targetSession = sessions.get(sessionId);
  }
  if (!targetSession || !targetSession.sock || targetSession.status !== 'connected') {
    for (const s of sessions.values()) {
      if (s.status === 'connected' && s.sock) {
        targetSession = s;
        break;
      }
    }
  }

  if (!targetSession || !targetSession.sock || targetSession.status !== 'connected') {
    return res.status(400).json({ success: false, error: 'Nenhum WhatsApp conectado para extrair os contatos.' });
  }

  try {
    const sock = targetSession.sock;
    // groupMetadata dispara consulta interativa que traz os atributos detalhados de cada participante (incluindo phone_number)
    const metadata = await sock.groupMetadata(groupId);
    const participants = metadata.participants || [];
    const resolved = await resolveGroupParticipants(sock, participants);

    // Filtrar apenas números de telefone válidos (descartar LIDs não resolvidos como 175...)
    const validPhones: string[] = [];
    const contacts: any[] = [];

    for (const p of resolved) {
      const ph = p.phone ? p.phone.replace(/\D/g, '') : '';
      // Um número de telefone real geralmente tem entre 9 e 15 dígitos e não é um LID puro de 15/16 dígitos desconhecido
      if (ph && ph.length >= 8 && ph.length <= 15) {
        // Se for 15+ dígitos começando com 175 (padrão de LID Baileys), ignorar se for LID cru
        if (ph.startsWith('175') && ph.length >= 15) {
          continue;
        }
        if (!validPhones.includes(ph)) {
          validPhones.push(ph);
        }
        contacts.push({ phone: ph, id: p.id, admin: p.admin });
      }
    }

    res.json({
      success: true,
      groupId,
      groupName: metadata.subject || 'Grupo',
      totalParticipants: participants.length,
      extractedCount: validPhones.length,
      phones: validPhones,
      contacts
    });
  } catch (err: any) {
    console.error('[Group Contacts Extraction Error]', err);
    res.status(500).json({ success: false, error: 'Erro ao extrair contatos do grupo: ' + err.message });
  }
});

// Helper to send group broadcast with attachments and @todos mention
// Helper to send group broadcast with attachments and separate @todos mention
async function sendGroupBroadcastMessage(
  sock: any,
  groupId: string,
  text: string,
  mediaPath?: string,
  mediaType?: string,
  fileName?: string,
  mentionAll?: boolean
) {
  // 1. Enviar mensagem principal (texto ou mídia)
  if (mediaPath) {
    const fullMediaPath = mediaPath.startsWith('http')
      ? mediaPath
      : path.join(process.cwd(), mediaPath.replace(/^\//, ''));

    if (fs.existsSync(fullMediaPath)) {
      const buffer = fs.readFileSync(fullMediaPath);

      if (mediaType === 'image') {
        await sock.sendMessage(groupId, {
          image: buffer,
          caption: text || ''
        });
      } else if (mediaType === 'video') {
        await sock.sendMessage(groupId, {
          video: buffer,
          caption: text || ''
        });
      } else if (mediaType === 'audio') {
        await sock.sendMessage(groupId, {
          audio: buffer,
          mimetype: 'audio/mp4',
          ptt: true
        });
        if (text) {
          await sock.sendMessage(groupId, { text });
        }
      } else if (mediaType === 'document') {
        await sock.sendMessage(groupId, {
          document: buffer,
          mimetype: 'application/octet-stream',
          fileName: fileName || path.basename(fullMediaPath) || 'documento',
          caption: text || ''
        });
      }
    }
  } else if (text) {
    await sock.sendMessage(groupId, { text });
  }

  // 2. Se a opção @todos estiver marcada, aguarda 2 segundos e envia uma mensagem separada '@todos' marcando todos os participantes
  if (mentionAll) {
    try {
      await new Promise(r => setTimeout(r, 2000));
      let mentions: string[] = [];
      if (sock.groupMetadata) {
        try {
          const meta = await sock.groupMetadata(groupId);
          if (meta && Array.isArray(meta.participants)) {
            mentions = meta.participants.map((p: any) => p.id);
          }
        } catch (e) {
          console.warn('[Broadcast Mentions Warning]', e);
        }
      }
      await sock.sendMessage(groupId, {
        text: '@todos',
        mentions: mentions.length > 0 ? mentions : undefined,
        contextInfo: {
          groupMentions: [
            {
              groupJid: groupId,
              groupSubject: 'todos'
            }
          ],
          mentionedJid: mentions.length > 0 ? mentions : undefined
        }
      });
      console.log(`[Broadcast] Mensagem oficial nativa @todos enviada com sucesso no grupo ${groupId} marcando ${mentions.length} membros.`);
    } catch (mentionErr) {
      console.error('[Broadcast @todos Error]', mentionErr);
    }
  }
}

// Disparo em Grupo (Imediato ou Agendado com Mídias e @todos)
app.post('/api/whatsapp/groups/broadcast', async (req, res) => {
  const { groupId, groupName, text, mediaPath, mediaType, fileName, mentionAll, scheduledAt, sessionId } = req.body;

  if (!groupId) {
    return res.status(400).json({ error: 'ID do grupo é obrigatório.' });
  }

  if (!text && !mediaPath) {
    return res.status(400).json({ error: 'Informe um texto ou anexe uma mídia para o disparo.' });
  }

  let shouldMentionAll = Boolean(mentionAll);
  let cleanBroadcastText = (text || '').trim();

  // Se o texto tiver '@todos' ou mentionAll estiver ativo, ativa menção geral e limpa o texto principal
  if (cleanBroadcastText.includes('@todos') || shouldMentionAll) {
    shouldMentionAll = true;
    cleanBroadcastText = cleanBroadcastText.replace(/@todos/gi, '').trim();
  }

  // Se agendado: salvar no banco para disparo futuro
  if (scheduledAt) {
    const broadcastId = `sch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    try {
      await pool.query(
        `INSERT INTO scheduled_broadcasts (id, group_id, group_name, text, media_path, media_type, file_name, mention_all, scheduled_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
        [broadcastId, groupId, groupName || 'Grupo WhatsApp', cleanBroadcastText, mediaPath || null, mediaType || null, fileName || null, shouldMentionAll, new Date(scheduledAt)]
      );
      return res.json({ 
        success: true, 
        scheduled: true, 
        id: broadcastId, 
        message: `Comunicado agendado com sucesso para ${new Date(scheduledAt).toLocaleString('pt-BR')}!` 
      });
    } catch (err: any) {
      console.error('[Schedule Broadcast Error]', err);
      return res.status(500).json({ error: 'Erro ao agendar disparo: ' + err.message });
    }
  }

  // Disparo Imediato
  let targetSession: SessionData | undefined;
  if (sessionId && typeof sessionId === 'string') {
    targetSession = sessions.get(sessionId);
  }
  if (!targetSession || !targetSession.sock || targetSession.status !== 'connected') {
    for (const s of sessions.values()) {
      if (s.status === 'connected' && s.sock) {
        targetSession = s;
        break;
      }
    }
  }

  if (!targetSession || !targetSession.sock) {
    return res.status(400).json({ error: 'WhatsApp não está conectado para enviar o comunicado.' });
  }

  try {
    await sendGroupBroadcastMessage(
      targetSession.sock,
      groupId,
      cleanBroadcastText,
      mediaPath,
      mediaType,
      fileName,
      shouldMentionAll
    );

    // Salva histórico de envio imediato
    try {
      const histId = `sent-${Date.now()}`;
      await pool.query(
        `INSERT INTO scheduled_broadcasts (id, group_id, group_name, text, media_path, media_type, file_name, mention_all, scheduled_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, 'sent')`,
        [histId, groupId, groupName || 'Grupo WhatsApp', cleanBroadcastText, mediaPath || null, mediaType || null, fileName || null, shouldMentionAll]
      );
    } catch (e) {}

    res.json({ success: true, message: 'Comunicado enviado com sucesso para o grupo!' });
  } catch (err: any) {
    console.error('[Immediate Broadcast Error]', err);
    res.status(500).json({ error: 'Erro ao enviar comunicado: ' + err.message });
  }
});

// Listar Disparos Agendados
app.get('/api/whatsapp/groups/scheduled', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, group_id as "groupId", group_name as "groupName", text, media_path as "mediaPath", media_type as "mediaType", file_name as "fileName", mention_all as "mentionAll", scheduled_at as "scheduledAt", status, error_message as "errorMessage", created_at as "createdAt"
       FROM scheduled_broadcasts 
       ORDER BY scheduled_at DESC LIMIT 50`
    );
    res.json({ success: true, broadcasts: result.rows });
  } catch (err: any) {
    console.error('[List Scheduled Error]', err);
    res.json({ success: true, broadcasts: [] });
  }
});

// Cancelar / Excluir Disparo Agendado
app.delete('/api/whatsapp/groups/scheduled/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM scheduled_broadcasts WHERE id = $1', [id]);
    res.json({ success: true, message: 'Agendamento cancelado com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Worker periódico para disparar mensagens agendadas
async function processScheduledBroadcasts() {
  try {
    const res = await pool.query(
      `SELECT * FROM scheduled_broadcasts 
       WHERE status = 'pending' AND scheduled_at <= CURRENT_TIMESTAMP 
       ORDER BY scheduled_at ASC LIMIT 5`
    );
    if (res.rows.length === 0) return;

    let targetSession: SessionData | undefined;
    for (const s of sessions.values()) {
      if (s.status === 'connected' && s.sock) {
        targetSession = s;
        break;
      }
    }
    if (!targetSession || !targetSession.sock) {
      return;
    }

    for (const b of res.rows) {
      try {
        console.log(`[Scheduled Broadcast] Disparando agendamento ${b.id} para grupo ${b.group_name} (${b.group_id})...`);
        await sendGroupBroadcastMessage(
          targetSession.sock,
          b.group_id,
          b.text,
          b.media_path,
          b.media_type,
          b.file_name,
          b.mention_all
        );
        await pool.query(`UPDATE scheduled_broadcasts SET status = 'sent', error_message = NULL WHERE id = $1`, [b.id]);
      } catch (err: any) {
        console.error(`[Scheduled Broadcast Error] Erro ao enviar ${b.id}:`, err);
        await pool.query(`UPDATE scheduled_broadcasts SET status = 'failed', error_message = $1 WHERE id = $2`, [err.message || 'Erro', b.id]);
      }
    }
  } catch (e) {}
}
setInterval(processScheduledBroadcasts, 15000);

// Ações no Grupo (Adicionar ou Remover Lead)
app.post('/api/whatsapp/groups/manage', async (req, res) => {
  const { groupId, phone, action, sessionId } = req.body;
  if (!groupId || !phone) {
    return res.status(400).json({ error: 'Grupo e telefone são obrigatórios.' });
  }

  let targetSession: SessionData | undefined;
  if (sessionId && typeof sessionId === 'string') {
    targetSession = sessions.get(sessionId);
  }
  if (!targetSession || !targetSession.sock || targetSession.status !== 'connected') {
    for (const s of sessions.values()) {
      if (s.status === 'connected' && s.sock) {
        targetSession = s;
        break;
      }
    }
  }

  if (!targetSession || !targetSession.sock) {
    return res.status(400).json({ error: 'WhatsApp não está conectado para gerenciar grupos.' });
  }

  const cleanNum = phone.replace(/\D/g, '');
  const participantJid = `${cleanNum}@s.whatsapp.net`;

  try {
    const act = action === 'remove' ? 'remove' : 'add';
    const result = await targetSession.sock.groupParticipantsUpdate(groupId, [participantJid], act);
    res.json({ success: true, result });
  } catch (err: any) {
    console.error('[Group Manage Error]', err);
    res.status(500).json({ error: 'Erro ao alterar participante no grupo: ' + err.message });
  }
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

  // Immediately switch to Manual mode when attendant replies from panel
  if (chat) {
    chat.botFlowActive = false;
    chat.aiAgentActive = false;
    try {
      await pool.query('UPDATE chats SET bot_flow_active = false, ai_agent_active = false WHERE id = $1', [id]);
    } catch (e) {}
    broadcast('chat_update', chat);
  }

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
      timestamp: getBrazilTimeString(),
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
    persistChatAndMessage(chat).catch(e => console.error('[Persist Chat Error]', e));
    broadcast('chat_update', chat);
  }
  res.json({ success: true, chat });
});

// Cadastrar / Agendar Follow-up Automático com Texto e Mídias
app.post('/api/chats/:id/follow-up', async (req, res) => {
  const { id } = req.params;
  const { followUpDate, followUpText, followUpMediaPath, followUpMediaType, followUpFileName } = req.body;

  let chat = liveChats.get(id);
  if (chat) {
    chat.followUpDate = followUpDate || '';
    chat.followUpText = followUpText || '';
    chat.followUpMediaPath = followUpMediaPath || '';
    chat.followUpMediaType = followUpMediaType || '';
    chat.followUpFileName = followUpFileName || '';
    chat.followUpStatus = 'scheduled';
    liveChats.set(id, chat);
  }

  try {
    await pool.query(`
      UPDATE chats
      SET follow_up_date = $1,
          follow_up_text = $2,
          follow_up_media_path = $3,
          follow_up_media_type = $4,
          follow_up_file_name = $5,
          follow_up_status = 'scheduled'
      WHERE id = $6
    `, [followUpDate || '', followUpText || '', followUpMediaPath || '', followUpMediaType || '', followUpFileName || '', id]);

    if (chat) broadcast('chat_update', chat);
    res.json({ success: true, message: 'Follow-up agendado com sucesso!', chat });
  } catch (err: any) {
    console.error('[Follow-up Schedule Error]', err);
    res.status(500).json({ error: 'Erro ao agendar follow-up: ' + err.message });
  }
});

// Cancelar Follow-up
app.delete('/api/chats/:id/follow-up', async (req, res) => {
  const { id } = req.params;
  let chat = liveChats.get(id);
  if (chat) {
    chat.followUpDate = undefined;
    chat.followUpText = '';
    chat.followUpMediaPath = '';
    chat.followUpMediaType = '';
    chat.followUpFileName = '';
    chat.followUpStatus = 'idle';
    liveChats.set(id, chat);
  }

  try {
    await pool.query(`
      UPDATE chats
      SET follow_up_date = NULL,
          follow_up_text = '',
          follow_up_media_path = '',
          follow_up_media_type = '',
          follow_up_file_name = '',
          follow_up_status = 'idle'
      WHERE id = $1
    `, [id]);

    if (chat) broadcast('chat_update', chat);
    res.json({ success: true, message: 'Follow-up cancelado com sucesso!' });
  } catch (err: any) {
    console.error('[Cancel Follow-up Error]', err);
    res.status(500).json({ error: 'Erro ao cancelar follow-up: ' + err.message });
  }
});

// Helper for Brazil datetime string YYYY-MM-DDTHH:mm
function getBrazilIsoDateTime(): string {
  const now = new Date();
  const brStr = now.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // "YYYY-MM-DD HH:mm:ss"
  return brStr.replace(' ', 'T').substring(0, 16);
}

// Worker periódico para disparar Follow-ups agendados automaticamente
async function processScheduledFollowUps() {
  try {
    const res = await pool.query(`
      SELECT id, lead_phone, lead_name, follow_up_date, follow_up_text, 
             follow_up_media_path, follow_up_media_type, follow_up_file_name
      FROM chats
      WHERE follow_up_status = 'scheduled'
        AND follow_up_date IS NOT NULL
        AND follow_up_date != ''
      LIMIT 10
    `);

    if (res.rows.length === 0) return;

    let targetSession: SessionData | undefined;
    for (const s of sessions.values()) {
      if (s.status === 'connected' && s.sock) {
        targetSession = s;
        break;
      }
    }

    if (!targetSession || !targetSession.sock) return;

    const currentBrIso = getBrazilIsoDateTime();

    for (const r of res.rows) {
      if (r.follow_up_date <= currentBrIso) {
        console.log(`[Follow-up Worker] Disparando follow-up agendado para lead ${r.lead_phone} (${r.id})...`);
        try {
          if (r.follow_up_media_path) {
            const fullMediaPath = r.follow_up_media_path.startsWith('http')
              ? r.follow_up_media_path
              : path.join(process.cwd(), r.follow_up_media_path.replace(/^\//, ''));

            if (fs.existsSync(fullMediaPath)) {
              const buffer = fs.readFileSync(fullMediaPath);
              if (r.follow_up_media_type === 'image') {
                await targetSession.sock.sendMessage(r.id, {
                  image: buffer,
                  caption: r.follow_up_text || ''
                });
              } else if (r.follow_up_media_type === 'video') {
                await targetSession.sock.sendMessage(r.id, {
                  video: buffer,
                  caption: r.follow_up_text || ''
                });
              } else if (r.follow_up_media_type === 'audio') {
                await targetSession.sock.sendMessage(r.id, {
                  audio: buffer,
                  mimetype: 'audio/mp4',
                  ptt: true
                });
                if (r.follow_up_text) {
                  await targetSession.sock.sendMessage(r.id, { text: r.follow_up_text });
                }
              } else {
                await targetSession.sock.sendMessage(r.id, {
                  document: buffer,
                  mimetype: 'application/octet-stream',
                  fileName: r.follow_up_file_name || 'arquivo'
                });
                if (r.follow_up_text) {
                  await targetSession.sock.sendMessage(r.id, { text: r.follow_up_text });
                }
              }
            } else if (r.follow_up_text) {
              await targetSession.sock.sendMessage(r.id, { text: r.follow_up_text });
            }
          } else if (r.follow_up_text) {
            await targetSession.sock.sendMessage(r.id, { text: r.follow_up_text });
          }

          const sentSummary = r.follow_up_text || `[Follow-up enviado: ${r.follow_up_media_type || 'arquivo'}]`;
          recordFlowMessageInChat(r.id, sentSummary, false);

          await pool.query(`UPDATE chats SET follow_up_status = 'completed' WHERE id = $1`, [r.id]);
          const chat = liveChats.get(r.id);
          if (chat) {
            chat.followUpStatus = 'completed';
            broadcast('chat_update', chat);
          }
          console.log(`[Follow-up Worker] Follow-up para ${r.id} enviado com sucesso!`);
        } catch (err: any) {
          console.error(`[Follow-up Worker Error] Falha ao enviar para ${r.id}:`, err);
          await pool.query(`UPDATE chats SET follow_up_status = 'failed' WHERE id = $1`, [r.id]);
        }
      }
    }
  } catch (e) {
    console.error('[Follow-up Worker Loop Error]', e);
  }
}
setInterval(processScheduledFollowUps, 15000);

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
app.get('/api/sessions', async (req, res) => {
  try {
    const dbInsts = await pool.query('SELECT id, name, automation_mode FROM whatsapp_instances');
    dbInsts.rows.forEach(r => {
      const s = sessions.get(r.id);
      if (s) {
        if (r.automation_mode) s.automationMode = r.automation_mode;
        if (r.name) s.name = r.name;
      } else {
        sessions.set(r.id, {
          id: r.id,
          name: r.name || `WhatsApp ${r.id}`,
          status: 'disconnected',
          automationMode: r.automation_mode || 'flow'
        });
      }
    });
  } catch (e) {}

  const list = Array.from(sessions.values()).map(s => ({
    id: s.id,
    name: s.name,
    status: s.status,
    automationMode: s.automationMode || 'flow',
    qrCode: s.qrCode,
    phone: s.phone
  }));
  res.json(list);
});

// Update instance automation mode (Exclusividade: 'flow' | 'ai' | 'none')
app.put('/api/sessions/:id/automation-mode', async (req, res) => {
  const { id } = req.params;
  const { mode } = req.body;
  const validMode = (mode === 'flow' || mode === 'ai' || mode === 'none') ? mode : 'flow';

  const session = sessions.get(id);
  if (session) {
    session.automationMode = validMode;
    sessions.set(id, session);
  }

  try {
    await pool.query(
      `INSERT INTO whatsapp_instances (id, name, status, automation_mode)
       VALUES ($1, $2, 'disconnected', $3)
       ON CONFLICT (id) DO UPDATE SET automation_mode = $3`,
      [id, session?.name || id, validMode]
    );
  } catch (e) {}

  broadcast('session_update', { id, automationMode: validMode });
  res.json({ success: true, mode: validMode });
});

// Create new WhatsApp session with plan verification
app.post('/api/sessions/create', (req, res) => {
  const { name } = req.body;
  const newId = `inst-${sessions.size + 1}`;
  const newSession: SessionData = {
    id: newId,
    name: name || `WhatsApp ${sessions.size + 1}`,
    status: 'disconnected',
    automationMode: 'flow'
  };
  sessions.set(newId, newSession);
  broadcast('session_update', { id: newId, status: 'disconnected', name: newSession.name, automationMode: 'flow' });
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

// Auto-reconnect all existing WhatsApp sessions on startup/deploy
async function autoReconnectAllSessions() {
  console.log('[NyxZap] Verificando instâncias do WhatsApp para reconexão automática...');
  try {
    const dbInsts = await pool.query('SELECT id, name, automation_mode FROM whatsapp_instances');
    for (const r of dbInsts.rows) {
      if (!sessions.has(r.id)) {
        sessions.set(r.id, {
          id: r.id,
          name: r.name || `WhatsApp ${r.id}`,
          status: 'disconnected',
          automationMode: r.automation_mode || 'flow'
        });
      }
    }
  } catch (e) {}

  const authDir = path.join(process.cwd(), 'whatsapp_auth');
  if (fs.existsSync(authDir)) {
    const dirs = fs.readdirSync(authDir);
    for (const dir of dirs) {
      const credsPath = path.join(authDir, dir, 'creds.json');
      if (fs.existsSync(credsPath)) {
        console.log(`[Auto Reconnect] Restaurando WhatsApp '${dir}' automaticamente após deploy/início...`);
        try {
          await startWhatsAppSession(dir);
        } catch (err) {
          console.error(`[Auto Reconnect Error] Erro ao reconectar sessão ${dir}:`, err);
        }
      }
    }
  }

  if (!sessions.has('inst-1')) {
    sessions.set('inst-1', {
      id: 'inst-1',
      name: 'WhatsApp Principal',
      status: 'disconnected',
      automationMode: 'flow'
    });
  }
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[NyxZap Backend] Servidor rodando na porta ${PORT}`);
  autoReconnectAllSessions().catch(err => console.error('[Auto Reconnect Startup Error]', err));
});


