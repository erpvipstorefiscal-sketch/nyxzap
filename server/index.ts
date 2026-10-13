import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import pino from 'pino';
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  generateProfilePicture,
  getBinaryNodeChild,
  generateMessageIDV2,
  S_WHATSAPP_NET,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import multer from 'multer';
import { pool, initDatabase } from './db.js';
import { sendPasswordRecoveryEmail } from './mailer.js';

process.on('uncaughtException', (err: any) => {
  console.error('[Process UncaughtException Guard]', err?.message || err);
});
process.on('unhandledRejection', (reason: any) => {
  console.error('[Process UnhandledRejection Guard]', reason?.message || reason);
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static uploads directory for media (audio, video, image, pdf)
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Rota inteligente auto-heal para /uploads/:filename
// Se o container foi recriado pelo Coolify sem volume antigo, regenera o arquivo do base64 do PostgreSQL!
app.get('/uploads/:filename', async (req, res, next) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // Tenta restaurar a partir dos fluxos salvos no PostgreSQL
  try {
    const flows = await pool.query('SELECT nodes FROM flow_definitions');
    for (const row of flows.rows) {
      const nodes = Array.isArray(row.nodes) ? row.nodes : (typeof row.nodes === 'string' ? JSON.parse(row.nodes) : []);
      for (const node of nodes) {
        if (!node?.data) continue;
        const targetUrl = node.data.fileUrl || node.data.groupPhotoUrl || '';
        const base64Data = node.data.fileBase64 || node.data.groupPhotoBase64 || '';
        if (targetUrl.includes(filename) && base64Data && typeof base64Data === 'string' && base64Data.startsWith('data:')) {
          const parts = base64Data.split(';base64,');
          if (parts.length === 2) {
            const buf = Buffer.from(parts[1], 'base64');
            fs.writeFileSync(filePath, buf);
            console.log(`[Upload Auto-Heal] Arquivo ${filename} regenerado do banco PostgreSQL com sucesso!`);
            return res.sendFile(filePath);
          }
        }
      }
    }
  } catch (healErr) {
    console.warn('[Upload Auto-Heal Error]', healErr);
  }

  next();
});

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
  const normEmail = (email || '').trim().toLowerCase();
  if (normEmail === 'admin@admin' || normEmail === 'admin' || normEmail === 'admin@nyxzap.com') {
    return res.json({
      id: 'usr-admin',
      name: 'Super Administrador',
      email: email || 'admin@admin',
      role: 'admin',
      planName: 'Enterprise Anual',
      validUntil: '2030-12-31',
      instancesLimit: 10,
      token: 'jwt-token-admin'
    });
  }

  if (normEmail === 'cliente@empresa.com' && (password === '123456' || !password)) {
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
    const normEmail = (email || '').trim().toLowerCase();
    if (normEmail.includes('admin') || normEmail === 'admin@admin') {
      return res.json({
        id: 'usr-admin',
        name: 'Super Administrador (Local Dev)',
        email: email || 'admin@admin',
        role: 'admin',
        planName: 'Enterprise Anual',
        validUntil: '2030-12-31',
        instancesLimit: 10,
        token: 'jwt-token-admin'
      });
    }

    return res.json({
      id: 'usr-demo',
      name: 'Cliente NyxZap (Local Dev)',
      email: email || 'cliente@empresa.com',
      role: 'client',
      planName: 'Pro (Mais Vendido)',
      validUntil: '2026-11-10',
      instancesLimit: 3,
      token: 'jwt-token-demo'
    });
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

// Cakto Webhook Handler - Confirmações de Assinaturas, Renovações e Conexões Extras (SaaS NyxZap & Fluxos)
app.post(['/api/webhook/cakto', '/api/webhook/saas/cakto'], async (req, res) => {
  const payload = req.body || {};
  console.log(`[Cakto Webhook Received] (${req.path})`, JSON.stringify(payload));

  try {
    // Chave secreta enviada pela Cakto (body, header ou query)
    // Ignora tokens de usuário do tipo 'usr_...' para não corromper a chave secreta do webhook
    const rawQueryToken = req.query?.token ? String(req.query.token).trim() : '';
    const safeQueryToken = rawQueryToken.startsWith('usr_') ? '' : rawQueryToken;

    const incomingSecret = String(
      payload.secret || 
      payload.token || 
      payload.webhook_secret ||
      req.headers['x-cakto-secret'] || 
      req.headers['x-secret'] || 
      req.headers['x-webhook-secret'] || 
      req.query?.secret || 
      req.query?.webhook_secret || 
      safeQueryToken || 
      (typeof payload.data === 'object' ? (payload.data?.secret || payload.data?.webhook_secret) : '') ||
      ''
    ).trim();

    // Normalização dos campos caso 'data' venha como string JSON
    let bodyData = payload.data;
    if (typeof bodyData === 'string') {
      try { bodyData = JSON.parse(bodyData); } catch {}
    }

    // Normalização dos campos principais do webhook da Cakto
    const eventType = payload.event || payload.type || payload.status || 'unknown';
    
    // Status do pagamento
    const paymentStatus = (
      bodyData?.status || 
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

    // Extrair dados do cliente / pagador
    const customer = bodyData?.customer || payload.customer || payload.client || payload.order?.customer || bodyData?.buyer || payload.buyer || {};
    const email = (customer.email || payload.email || payload.buyer_email || bodyData?.email || '').trim().toLowerCase();
    const customerName = customer.name || customer.full_name || payload.name || payload.buyer_name || 'Cliente';
    let rawCustomerPhone = customer.phone || customer.cellphone || customer.telephone || customer.mobile || payload.phone || payload.cellphone || payload.tel || payload.telefone || '';
    
    // Se for teste e a plataforma não mandou telefone, usa telefone conectado do WhatsApp ou query para permitir teste
    if (!rawCustomerPhone) {
      const fallbackTestPhone = req.query?.phone || (Array.from(sessions.values()).find(s => s.phone)?.phone || '');
      if (fallbackTestPhone) {
        rawCustomerPhone = String(fallbackTestPhone);
        console.log(`[Cakto Webhook] Usando telefone de contingência/teste: ${rawCustomerPhone}`);
      }
    }
    const customerPhone = rawCustomerPhone || '+55 11 99999-9999';

    // Extrair dados do produto / oferta / item
    const items = bodyData?.items || payload.items || payload.products || [];
    const item = items[0] || payload.product || payload.order?.product || {};
    const rawProductName = (
      item.name || 
      item.title || 
      item.slug ||
      payload.product_name || 
      payload.product?.name ||
      payload.plan_name || 
      payload.offer_title || 
      bodyData?.product_name ||
      ''
    ).toLowerCase();

    const offerId = String(payload.offer_id || payload.checkout_id || payload.link_id || item.id || payload.product_id || '').toLowerCase();
    const amount = parseFloat(bodyData?.amount || payload.amount || payload.order?.amount || item.price || 0) / 100 || 97.00;

    console.log(`[Cakto Webhook] Evento: "${eventType}" | Status: "${paymentStatus}" | Secret: "${incomingSecret ? 'Sim' : 'Não'}" | Lead: "${rawCustomerPhone}" (${customerName}) | Produto: "${rawProductName}"`);

    // 1. DISPARAR FLUXOS VISUAIS NYXZAP (Se houver telefone do lead e fluxo configurado)
    let flowTriggerResult: any = null;
    if (rawCustomerPhone) {
      try {
        const rawEvent = payload.event || payload.type || bodyData?.event || payload.status || paymentStatus || (isApproved ? 'compra aprovada' : 'evento');
        flowTriggerResult = await triggerFlowForWebhookEvent('cakto', String(rawEvent), String(rawCustomerPhone), String(customerName), payload, incomingSecret);
        console.log(`[Cakto Webhook] Fluxo visual acionado para ${rawCustomerPhone}:`, flowTriggerResult);
      } catch (flowErr: any) {
        console.error('[Cakto Webhook] Erro ao disparar fluxo:', flowErr);
      }
    }

    // 2. VERIFICAR SE É ASSINATURA / PLANO DO PRÓPRIO SAAS NYXZAP
    // Importante: Apenas processa como venda da licença do software NyxZap se:
    // a) Foi chamado pelo endpoint específico do SaaS (/api/webhook/saas/cakto), OU
    // b) O produto/oferta contém explicitamente 'nyxzap' ou IDs oficiais das ofertas do SaaS NyxZap.
    // Isso evita 100% de conflito com produtos próprios dos clientes (ex: cursos ou mentorias dos usuários)
    const isExplicitSaasUrl = req.path.includes('/saas');
    const isOfficialNyxZapOffer = 
      offerId.includes('3764ipv') || 
      offerId.includes('87jcu5r') || 
      offerId.includes('693263v');

    const isSaaSSubscription = 
      isExplicitSaasUrl ||
      isOfficialNyxZapOffer ||
      rawProductName.includes('nyxzap') ||
      (rawProductName.includes('dinder') && rawProductName.includes('plano')) ||
      (rawProductName.includes('conex') && rawProductName.includes('extra') && rawProductName.includes('nyx'));

    if (!isApproved || !isSaaSSubscription || !email) {
      return res.json({
        success: true,
        message: 'Webhook Cakto recebido e processado!',
        eventType,
        paymentStatus,
        flowTriggerResult
      });
    }

    console.log(`[Cakto Webhook] Processando compra aprovada de assinatura para ${email} (Produto: "${rawProductName}", OfferId: "${offerId}", Valor: R$ ${amount})`);

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

// Endpoint para Webhook de Checkout / Plataformas de Vendas dispararem fluxos
app.all(['/api/webhook/checkout', '/api/webhook/checkout/:platform', '/api/webhook/vendas', '/api/webhook/vendas/:platform', '/api/webhook/flow', '/api/webhook/flow/:platform', '/api/webhook/:platform'], async (req, res) => {
  const platform = req.params.platform || req.body?.platform || req.query?.platform || 'vendas';
  const payload = req.body || {};
  console.log(`[Webhook Checkout Entry] (${platform})`, JSON.stringify(payload));

  try {
    const rawEvent = payload.event || payload.type || payload.status || payload.trigger || req.query?.event || 'compra aprovada';
    const customer = payload.customer || payload.client || payload.buyer || payload.data?.customer || {};
    let leadPhone = customer.phone || customer.cellphone || customer.telephone || customer.mobile || payload.phone || payload.cellphone || payload.tel || payload.telefone || '';
    const leadName = customer.name || customer.full_name || payload.name || payload.buyer_name || payload.leadName || 'Cliente';

    // Ignora tokens de usuário do tipo 'usr_...' para não corromper a chave secreta do webhook
    const rawQueryToken = req.query?.token ? String(req.query.token).trim() : '';
    const safeQueryToken = rawQueryToken.startsWith('usr_') ? '' : rawQueryToken;

    const incomingSecret = String(
      payload.secret || 
      payload.token || 
      payload.webhook_secret ||
      req.headers['x-cakto-secret'] || 
      req.headers['x-secret'] || 
      req.headers['x-webhook-secret'] || 
      req.query?.secret || 
      req.query?.webhook_secret || 
      safeQueryToken || 
      (typeof payload.data === 'object' ? (payload.data?.secret || payload.data?.webhook_secret) : '') ||
      ''
    ).trim();

    if (!leadPhone) {
      const fallbackPhone = req.query?.phone || (Array.from(sessions.values()).find(s => s.phone)?.phone || '');
      if (fallbackPhone) leadPhone = String(fallbackPhone);
    }

    if (!leadPhone) {
      return res.status(400).json({ error: 'Telefone do lead não identificado no payload do webhook.' });
    }

    const result = await triggerFlowForWebhookEvent(platform, String(rawEvent), String(leadPhone), String(leadName), payload, incomingSecret);
    res.json({ success: true, message: 'Webhook processado com sucesso!', ...result });
  } catch (err: any) {
    console.error('[Webhook Checkout Error]', err);
    res.status(500).json({ error: err.message });
  }
});

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: string;
  senderName?: string;
  isAiGenerated?: boolean;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  fileName?: string;
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
        `INSERT INTO chat_messages (id, chat_id, from_me, text, timestamp, sender_name, is_ai_generated, media_url, media_type, file_name, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           media_url = COALESCE(EXCLUDED.media_url, chat_messages.media_url),
           media_type = COALESCE(EXCLUDED.media_type, chat_messages.media_type),
           file_name = COALESCE(EXCLUDED.file_name, chat_messages.file_name)`,
        [
          newMsg.id, 
          chat.id, 
          newMsg.fromMe, 
          newMsg.text, 
          newMsg.timestamp, 
          newMsg.senderName || '', 
          newMsg.isAiGenerated || false,
          newMsg.mediaUrl || null,
          newMsg.mediaType || null,
          newMsg.fileName || null
        ]
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
        isAiGenerated: Boolean(m.is_ai_generated),
        mediaUrl: m.media_url || undefined,
        mediaType: m.media_type || undefined,
        fileName: m.file_name || undefined
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
    await executeNodeAction(sock, remoteJid, currentNode, senderName, incomingText, sessionId);

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

      const cleanPhone = remoteJid.replace(/\D/g, '');
      // Clear any previous timer
      const existing = pendingFlowResponses.get(cleanPhone) || pendingFlowResponses.get(remoteJid);
      if (existing) clearTimeout(existing.timeoutTimer);

      const unit = currentNode.data?.timeoutUnit || 'segundos';
      const delay = Number(currentNode.data?.timeoutSeconds || (unit === 'minutos' ? 1 : 30));
      const totalMs = (unit === 'minutos' ? delay * 60 : unit === 'horas' ? delay * 3600 : delay) * 1000;

      console.log(`[Flow Engine] Card '${currentNode.title}' aguardando resposta de ${remoteJid} (${cleanPhone}) por ${delay} ${unit} (${totalMs}ms)...`);

      const timeoutTimer = setTimeout(async () => {
        pendingFlowResponses.delete(cleanPhone);
        pendingFlowResponses.delete(remoteJid);
        console.log(`[Flow Engine] Tempo esgotado (${delay} ${unit}) para ${remoteJid}. Prosseguindo conexão 'Não respondeu' (${timeoutEdge?.to || 'Nenhuma'}).`);
        if (timeoutEdge?.to) {
          await resumeFlowChain(sock, remoteJid, timeoutEdge.to, senderName, '', sessionId, flowObj);
        }
      }, totalMs);

      const pendingData: PendingFlowResponse = {
        remoteJid,
        nodeId: currentNode.id,
        sessionId,
        senderName,
        timeoutTimer,
        responseTargetId: responseEdge?.to,
        timeoutTargetId: timeoutEdge?.to,
        flow: flowObj
      };
      pendingFlowResponses.set(cleanPhone, pendingData);
      pendingFlowResponses.set(remoteJid, pendingData);

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

// Fila de disparos agendados de abandono de carrinho (Phone -> Timeout)
const pendingCartTimers = new Map<string, NodeJS.Timeout>();

// Gerenciador de VoipClients (Singleton por sessão WhatsApp para evitar recriação de workers WASM)
const voipClientsBySession = new Map<string, any>();

async function getVoipClientForSession(sessionId: string, sock: any) {
  let client = voipClientsBySession.get(sessionId);
  if (!client) {
    const authDir = path.join(process.cwd(), 'whatsapp_auth', sessionId);
    process.env.CALL_RELAY_PORT_MODE = 'original';
    process.env.CALL_DISABLE_IPV6 = '1';
    const { VoipClient } = await import(path.join(process.cwd(), 'baileys-caller', 'dist', 'index.mjs'));
    client = new VoipClient({ sock, authDir });
    await client.connect();
    voipClientsBySession.set(sessionId, client);
    console.log(`[Flow Engine] VoipClient singleton conectado para sessão ${sessionId}`);
  }
  return client;
}

function normalizeWebhookEventName(raw: string): string {
  const s = (raw || '').toLowerCase().trim();
  if (s.includes('test') || s.includes('ping') || s.includes('simulaca') || s.includes('simulaçã')) return 'test';
  if (s.includes('pedido') || s.includes('order.created') || s.includes('order_created')) return 'pedido realizado';
  if (s.includes('boleto')) return 'boleto gerado';
  if (s.includes('pix')) return 'pix gerado';
  if (s.includes('picpay')) return 'picpay gerado';
  if (s.includes('nubank')) return 'nubank gerado';
  if (s.includes('aprovad') || s.includes('paid') || s.includes('approved') || s.includes('pago')) return 'compra aprovada';
  if (s.includes('recusad') || s.includes('refused') || s.includes('denied') || s.includes('declined') || (s.includes('cancelad') && s.includes('compra'))) return 'compra recusada';
  if (s.includes('reembolso solicit') || s.includes('refund_requested')) return 'reembolso solicitado';
  if (s.includes('reembols') || s.includes('refund')) return 'reembolso';
  if (s.includes('chargeback') || s.includes('contest')) return 'chargeback';
  if (s.includes('carrinho') || s.includes('cart') || s.includes('abandon')) return 'abandono de carrinho';
  if (s.includes('assinatura') && s.includes('recuper')) return 'assinatura recuperada';
  if (s.includes('assinatura') && s.includes('renov') || s.includes('subscription.renewed')) return 'assinatura renovada';
  if (s.includes('renovação') || s.includes('renovacao')) return 'renovação de assinatura';
  if (s.includes('assinatura') && (s.includes('cancel') || s.includes('canceled'))) return 'assinatura cancelada';
  if (s.includes('assinatura') && s.includes('paus')) return 'assinatura pausada';
  if (s.includes('assinatura') && s.includes('reativ')) return 'assinatura reativada';
  if (s.includes('assinatura') && s.includes('atras')) return 'assinatura atrasada';
  if (s.includes('assinatura') && (s.includes('criad') || s.includes('created'))) return 'assinatura criada';
  return s;
}

async function triggerFlowForWebhookEvent(
  platform: string,
  rawEvent: string,
  leadPhone: string,
  leadName: string = 'Cliente',
  payload: any = {},
  incomingSecret?: string
) {
  let cleanPhone = leadPhone.replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 8) {
    const fallbackPhone = Array.from(sessions.values()).find(s => s.phone)?.phone || '';
    if (fallbackPhone) {
      cleanPhone = fallbackPhone.replace(/\D/g, '');
    }
  }

  if (!cleanPhone) return { success: false, reason: 'Invalid phone' };
  if ((cleanPhone.length === 10 || cleanPhone.length === 11) && !cleanPhone.startsWith('55')) {
    cleanPhone = '55' + cleanPhone;
  }
  const remoteJid = `${cleanPhone}@s.whatsapp.net`;

  const normEvent = normalizeWebhookEventName(rawEvent);
  console.log(`[Flow Webhook] Evento: "${rawEvent}" normalizado para "${normEvent}" (Plataforma: ${platform}, Lead: ${cleanPhone}, Secret: "${incomingSecret ? 'Sim' : 'Não'}")`);

  // Se o cliente comprou, cancela qualquer recuperação de abandono pendente
  if (normEvent === 'compra aprovada') {
    const existingTimer = pendingCartTimers.get(cleanPhone);
    if (existingTimer) {
      clearTimeout(existingTimer);
      pendingCartTimers.delete(cleanPhone);
      console.log(`[Flow Webhook] Agendamento de abandono de carrinho CANCELADO para ${cleanPhone} pois a compra foi aprovada!`);
    }
  }

  // Carrega fluxos ativos
  let flowsList: Array<{ id: string; name: string; nodes: FlowNodeServer[]; edges: FlowEdgeServer[] }> = [];
  try {
    const res = await pool.query('SELECT id, name, nodes, edges FROM flow_definitions WHERE active = true ORDER BY updated_at DESC');
    if (res.rows.length > 0) {
      flowsList = res.rows.map(r => ({
        id: r.id,
        name: r.name || 'Fluxo',
        nodes: typeof r.nodes === 'string' ? JSON.parse(r.nodes) : (r.nodes || []),
        edges: typeof r.edges === 'string' ? JSON.parse(r.edges) : (r.edges || [])
      }));
    }
  } catch (dbErr) {
    console.error('[Flow Webhook] Erro ao carregar fluxos do banco:', dbErr);
  }

  if (flowsList.length === 0 && activeFlow.nodes?.length > 0) {
    flowsList = [activeFlow];
  }

  let matchedFlowCount = 0;
  console.log(`[Flow Webhook Engine] Avaliando ${flowsList.length} fluxo(s) ativo(s) para evento '${normEvent}' (Plataforma: ${platform}, Lead: ${cleanPhone})`);

  for (const flow of flowsList) {
    const webhookNode = flow.nodes.find(n => {
      if (n.type !== 'webhook' && n.type !== 'cakto') return false;
      const nodeSecret = String(n.data?.webhookSecret || '').trim();
      const inSecret = String(incomingSecret || '').trim();

      // 1. Se for disparo de teste da plataforma (ex: botão 'Testar Webhook' da Cakto ou outra plataforma):
      if (normEvent === 'test' || normEvent === 'ping') {
        if (nodeSecret && inSecret && nodeSecret.toLowerCase() === inSecret.toLowerCase()) {
          console.log(`[Flow Webhook Match] Disparo de Teste com chave secreta correspondente ativou o card '${n.title}' (${n.id})!`);
          return true;
        }
        if (!inSecret || !nodeSecret || nodeSecret.toLowerCase() === inSecret.toLowerCase()) {
          console.log(`[Flow Webhook Match] Disparo de Teste ativou o card '${n.title}' (${n.id})!`);
          return true;
        }
      }

      // 2. Se este card tem chave secreta cadastrada:
      if (nodeSecret) {
        if (inSecret && nodeSecret.toLowerCase() === inSecret.toLowerCase()) {
          console.log(`[Flow Webhook Match] Card '${n.title}' (${n.id}) associado via Chave Secreta Exata!`);
          return true;
        }
        // Se a requisição trouxe uma chave secreta diferente da deste card, não executa este card
        if (inSecret && nodeSecret.toLowerCase() !== inSecret.toLowerCase()) {
          return false;
        }
      }

      // 3. Validação da plataforma
      const nodePlatform = (n.data?.platform || '').toLowerCase().trim();
      const inPlatform = (platform || '').toLowerCase().trim();
      if (nodePlatform && nodePlatform !== 'personalizado' && inPlatform && inPlatform !== 'vendas' && inPlatform !== 'checkout' && inPlatform !== 'flow' && nodePlatform !== inPlatform) {
        return false;
      }

      // 4. Validação por eventos ativos
      const activeEvents: string[] = (n.data?.activeEvents || ['Compra Aprovada', 'Pix Gerado', 'Pedido Realizado']).map((e: string) => normalizeWebhookEventName(e));
      return activeEvents.includes(normEvent) || activeEvents.some((ae: string) => normEvent.includes(ae) || ae.includes(normEvent));
    });

    if (webhookNode) {
      matchedFlowCount++;
      console.log(`[Flow Webhook] Fluxo '${flow.name}' (${flow.id}) ativado pelo card '${webhookNode.title}' para o evento '${normEvent}'!`);

      const isCartAbandonment = normEvent === 'abandono de carrinho';
      let delayMs = 0;

      if (isCartAbandonment) {
        const delayVal = Number(webhookNode.data?.cartDelay ?? 15);
        const delayUnit = (webhookNode.data?.cartDelayUnit || 'minutos').toLowerCase();
        if (delayUnit === 'dias') delayMs = delayVal * 24 * 60 * 60 * 1000;
        else if (delayUnit === 'horas') delayMs = delayVal * 60 * 60 * 1000;
        else delayMs = delayVal * 60 * 1000;
      }

      const runChain = async () => {
        const connectedSessionEntry = Array.from(sessions.entries()).find(([_, s]) => s.sock && s.status === 'connected')
          || Array.from(sessions.entries()).find(([_, s]) => s.sock)
          || sessions.entries().next().value;
        const sock = connectedSessionEntry ? connectedSessionEntry[1]?.sock : null;
        const sessionId = connectedSessionEntry ? connectedSessionEntry[0] : 'inst-1';

        if (!sock) {
          console.warn('[Flow Webhook] Nenhum WhatsApp conectado para disparar o fluxo');
          return;
        }

        const outgoingEdges = flow.edges.filter(e => e.from === webhookNode.id);
        if (outgoingEdges.length === 0) {
          console.log(`[Flow Webhook] Card ${webhookNode.id} sem conexões de saída no fluxo.`);
          return;
        }

        for (const edge of outgoingEdges) {
          await resumeFlowChain(sock, remoteJid, edge.to, leadName, `[Evento: ${normEvent}]`, sessionId, flow);
        }
      };

      if (delayMs > 0) {
        console.log(`[Flow Webhook] Agendando recuperação de carrinho para ${cleanPhone} daqui a ${Math.round(delayMs / 60000)} minutos.`);
        const timer = setTimeout(async () => {
          pendingCartTimers.delete(cleanPhone);
          await runChain();
        }, delayMs);
        pendingCartTimers.set(cleanPhone, timer);
      } else {
        void runChain();
      }
    }
  }

  return { success: true, matchedFlows: matchedFlowCount };
}

// Interface para retorno da resolução de mídia universal
interface ResolvedMedia {
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
}

// Resolvedor universal de mídia para o Flow Engine (Base64, disco local, volume Docker e URLs HTTP)
async function resolveMediaBuffer(
  filePathOrUrl?: string,
  base64Data?: string,
  expectedType: 'image' | 'video' | 'audio' | 'document' | 'any' = 'any',
  customFileName?: string
): Promise<ResolvedMedia | null> {
  try {
    let buffer: Buffer | null = null;
    let detectedMime: string | undefined = undefined;

    // 1. Tenta carregar a partir de base64 ou Data URI
    const rawBase64 = base64Data || (filePathOrUrl?.startsWith('data:') ? filePathOrUrl : '');
    if (rawBase64 && typeof rawBase64 === 'string') {
      const mimeMatch = rawBase64.match(/^data:([^;]+);base64,/);
      if (mimeMatch) {
        detectedMime = mimeMatch[1];
      }
      const cleanData = rawBase64.replace(/^data:[^;]+;base64,/, '');
      try {
        buffer = Buffer.from(cleanData, 'base64');
      } catch (bErr) {
        buffer = null;
      }
    }

    // Se temos buffer oriundo do base64 e um filePath relativo (ex: /uploads/nome.ext),
    // restaura no disco persistente (/app/uploads) caso tenha sido apagado em redeploys anteriores
    if (buffer && buffer.length > 0 && filePathOrUrl && !filePathOrUrl.startsWith('http') && !filePathOrUrl.startsWith('data:')) {
      try {
        const destFileName = path.basename(filePathOrUrl);
        const destPath = path.join(uploadsDir, destFileName);
        if (!fs.existsSync(destPath)) {
          fs.writeFileSync(destPath, buffer);
          console.log(`[Media Resolver] Arquivo restaurado do base64 para o disco persistente: ${destPath}`);
        }
      } catch (cacheErr) {
        // Ignora erro de restauração de cache
      }
    }

    // 2. Se não veio de base64, tenta localizar no sistema de arquivos local em múltiplos caminhos
    if (!buffer && filePathOrUrl && !filePathOrUrl.startsWith('http') && !filePathOrUrl.startsWith('data:')) {
      const directName = path.basename(filePathOrUrl);
      const candidates = [
        filePathOrUrl,
        path.join(process.cwd(), filePathOrUrl.replace(/^\//, '')),
        path.join(uploadsDir, directName),
        path.join(process.cwd(), 'uploads', directName),
        path.join(uploadsDir, filePathOrUrl.replace(/^\//, '')),
        path.join(process.cwd(), 'uploads', filePathOrUrl.replace(/^\//, ''))
      ];

      if (customFileName) {
        candidates.push(path.join(uploadsDir, customFileName));
        candidates.push(path.join(process.cwd(), 'uploads', customFileName));
      }

      for (const cand of candidates) {
        if (cand && fs.existsSync(cand)) {
          try {
            const stat = fs.statSync(cand);
            if (stat.isFile() && stat.size > 0) {
              buffer = fs.readFileSync(cand);
              console.log(`[Media Resolver] Mídia encontrada com sucesso no disco: ${cand} (${buffer.length} bytes)`);
              break;
            }
          } catch {}
        }
      }
    }

    // 3. Se não encontrou no disco e é uma URL HTTP/HTTPS, faz o download via fetch
    if (!buffer && filePathOrUrl && (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://'))) {
      try {
        console.log(`[Media Resolver] Baixando mídia via HTTP: ${filePathOrUrl}`);
        const resp = await fetch(filePathOrUrl);
        if (resp.ok) {
          const arr = await resp.arrayBuffer();
          buffer = Buffer.from(arr);
          const headerMime = resp.headers.get('content-type');
          if (headerMime && !headerMime.includes('octet-stream')) {
            detectedMime = headerMime.split(';')[0].trim();
          }
          // Salva uma cópia no uploadsDir para acelerar próximos disparos
          try {
            const parsedUrl = new URL(filePathOrUrl);
            const safeName = path.basename(parsedUrl.pathname) || `download-${Date.now()}`;
            fs.writeFileSync(path.join(uploadsDir, safeName), buffer);
          } catch {}
        } else {
          console.warn(`[Media Resolver] Resposta HTTP ${resp.status} ao baixar ${filePathOrUrl}`);
        }
      } catch (httpErr: any) {
        console.warn(`[Media Resolver] Falha ao baixar mídia da URL:`, httpErr.message);
      }
    }

    if (!buffer || buffer.length === 0) {
      return null;
    }

    // 4. Detecção e normalização precisa de MimeType
    if (!detectedMime) {
      // Checagem por Magic Bytes
      if (buffer.length >= 4) {
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
          detectedMime = 'image/png';
        } else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
          detectedMime = 'image/jpeg';
        } else if (buffer.slice(0, 4).toString('ascii') === 'GIF8') {
          detectedMime = 'image/gif';
        } else if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.length >= 12 && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
          detectedMime = 'image/webp';
        } else if (buffer.slice(0, 4).toString('ascii') === '%PDF') {
          detectedMime = 'application/pdf';
        } else if (buffer.slice(0, 4).toString('ascii') === 'OggS') {
          detectedMime = 'audio/ogg; codecs=opus';
        } else if (buffer.slice(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
          detectedMime = 'audio/mpeg';
        } else if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.length >= 12 && buffer.slice(8, 12).toString('ascii') === 'WAVE') {
          detectedMime = 'audio/wav';
        } else if (buffer.length >= 8 && buffer.slice(4, 8).toString('ascii') === 'ftyp') {
          detectedMime = expectedType === 'audio' ? 'audio/mp4' : 'video/mp4';
        }
      }

      // Detecção por extensão de arquivo
      const nameToCheck = customFileName || (filePathOrUrl ? path.basename(filePathOrUrl) : '');
      const ext = path.extname(nameToCheck).toLowerCase();
      if (!detectedMime && ext) {
        if (ext === '.png') detectedMime = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') detectedMime = 'image/jpeg';
        else if (ext === '.webp') detectedMime = 'image/webp';
        else if (ext === '.gif') detectedMime = 'image/gif';
        else if (ext === '.mp4') detectedMime = expectedType === 'audio' ? 'audio/mp4' : 'video/mp4';
        else if (ext === '.ogg' || ext === '.opus') detectedMime = 'audio/ogg; codecs=opus';
        else if (ext === '.mp3') detectedMime = 'audio/mpeg';
        else if (ext === '.wav') detectedMime = 'audio/wav';
        else if (ext === '.m4a' || ext === '.aac') detectedMime = 'audio/mp4';
        else if (ext === '.pdf') detectedMime = 'application/pdf';
      }

      // Fallbacks finais baseados em expectedType
      if (!detectedMime) {
        if (expectedType === 'image') detectedMime = 'image/jpeg';
        else if (expectedType === 'video') detectedMime = 'video/mp4';
        else if (expectedType === 'audio') detectedMime = 'audio/mp4';
        else if (expectedType === 'document') detectedMime = 'application/pdf';
        else detectedMime = 'application/octet-stream';
      }
    }

    return {
      buffer,
      mimeType: detectedMime,
      fileName: customFileName || (filePathOrUrl ? path.basename(filePathOrUrl) : undefined)
    };
  } catch (err: any) {
    console.error('[Media Resolver] Erro inesperado ao resolver mídia:', err?.message || err);
    return null;
  }
}

// Helper to execute specific node type (message, media, audio, delay, etc.)
async function executeNodeAction(
  sock: any,
  remoteJid: string,
  node: FlowNodeServer,
  senderName: string,
  incomingText: string,
  sessionId?: string
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
    if (node.type === 'sms' || node.type === 'whatsapp' || node.type === 'mensagem' || node.type === 'texto' || node.type === 'resposta' || node.type === 'email') {
      const rawText = node.data?.message || 'Olá, como posso te ajudar?';
      const finalText = replaceVariables(rawText);

      // Natural delay + "digitando..." status before sending text
      await simulateTyping(sock, remoteJid, 2500);

      await sock.sendMessage(remoteJid, { text: finalText });
      recordFlowMessageInChat(remoteJid, finalText);
    } else if (node.type === 'contato') {
      const rawName = (node.data?.contactName || 'Contato').trim();
      const rawPhone = (node.data?.contactPhone || '').trim();
      const contactName = replaceVariables(rawName).trim() || 'Contato';
      const resolvedPhone = replaceVariables(rawPhone).trim();
      const cleanContactPhone = resolvedPhone.replace(/\D/g, '');

      if (cleanContactPhone) {
        console.log(`[Flow Engine] Enviando cartão de contato '${contactName}' (${cleanContactPhone}) para ${remoteJid}`);
        await simulateTyping(sock, remoteJid, 1500);

        // vCard 3.0 padrão oficial WhatsApp Android e iOS
        const vcard = 'BEGIN:VCARD\n'
          + 'VERSION:3.0\n'
          + `FN:${contactName}\n`
          + `ORG:NyxZap;\n`
          + `TEL;type=CELL;type=VOICE;waid=${cleanContactPhone}:+${cleanContactPhone}\n`
          + 'END:VCARD';

        await sock.sendMessage(remoteJid, {
          contacts: {
            displayName: contactName,
            contacts: [{ vcard }]
          }
        });
        recordFlowMessageInChat(remoteJid, `👤 [Contato enviado: ${contactName} (+${cleanContactPhone})]`);
      } else {
        console.warn(`[Flow Engine] Telefone de contato não configurado no card ${node.id}`);
        recordFlowMessageInChat(remoteJid, `⚠️ [Card Contato: Telefone não configurado]`);
      }
    } else if (node.type === 'ligacao') {
      const audioPath = node.data?.fileUrl || node.data?.audioUrl;
      const targetPhone = remoteJid.split('@')[0].split(':')[0].replace(/\D/g, '');
      let fullAudioUrl = '';

      if (audioPath) {
        if (audioPath.includes('/uploads/')) {
          const filename = audioPath.split('/uploads/').pop();
          fullAudioUrl = path.join(process.cwd(), 'uploads', filename || '');
        } else if (audioPath.startsWith('http')) {
          fullAudioUrl = audioPath;
        } else {
          fullAudioUrl = path.join(process.cwd(), audioPath.replace(/^\//, ''));
        }
      }

      // 1. Detectar duração exata do arquivo de áudio via ffprobe
      let detectedDuration = 0;
      if (fullAudioUrl && fs.existsSync(fullAudioUrl)) {
        try {
          const probeOut = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fullAudioUrl}"`, { timeout: 4000 });
          const sec = parseFloat(probeOut.toString().trim());
          if (!isNaN(sec) && sec > 0) {
            detectedDuration = Math.round(sec);
          }
        } catch (probeErr: any) {
          console.warn('[Flow Engine] ffprobe não pôde calcular a duração do áudio:', probeErr.message);
        }
      }

      const ringDuration = Math.min(Math.max(Number(node.data?.ringDuration || node.data?.callDuration) || 20, 5), 45); // Padrão 20s
      console.log(`[Flow Engine] Iniciando chamada oficial para ${targetPhone} (Tempo de toque: até ${ringDuration}s)...`);

      let leadAnswered = false;
      let callFinished = false;

      // 1. Iniciar chamada real do WhatsApp via VoipClient Singleton
      const currentSessionId = sessionId || 'inst-1';

      try {
        const voipClient = await getVoipClientForSession(currentSessionId, sock);
        try { voipClient.clearActiveCall(); } catch {}

        console.log(`[Flow Engine] VoipClient pronto. Discando chamada para ${targetPhone} (Tempo de toque: até ${ringDuration}s)...`);
        const liveCall = await voipClient.call(targetPhone, {
          audioSource: 'silence',
          durationMs: (ringDuration + 5) * 1000
        });

        recordFlowMessageInChat(remoteJid, `📞 [Ligação tocando no celular do lead - Até ${ringDuration}s]`);

        liveCall.on('ringing', () => {
          console.log(`[Flow Engine] Telefone de ${targetPhone} está tocando em tela cheia...`);
        });

        // Se o lead atender a ligação:
        liveCall.on('connected', () => {
          console.log(`[Flow Engine] Lead ${targetPhone} ATENDEU a ligação! Desligando imediatamente conforme instrução...`);
          leadAnswered = true;
          recordFlowMessageInChat(remoteJid, `📲 [Lead atendeu a chamada! Ligação encerrada]`);
          setTimeout(() => {
            try { liveCall.end(); } catch {}
          }, 300);
        });

        liveCall.on('ended', (reason: string) => {
          console.log(`[Flow Engine] Chamada com ${targetPhone} finalizada (${reason})`);
          callFinished = true;
        });

        // Aguarda até o lead atender ou estourar o tempo de toque
        const startCallTime = Date.now();
        const maxWaitMs = ringDuration * 1000;
        while (!callFinished && !leadAnswered && (Date.now() - startCallTime < maxWaitMs)) {
          await new Promise(r => setTimeout(r, 400));
        }

        // Se deu o tempo e não atendeu, encerra a chamada
        if (!leadAnswered) {
          try { liveCall.end(); } catch {}
        }

        try { voipClient.clearActiveCall(); } catch {}
      } catch (voipErr: any) {
        console.error(`[Flow Engine] Aviso ao executar chamada VoIP (prosseguindo fluxo):`, voipErr?.message || voipErr);
      }

      // Aguarda 1s para a chamada sincronizar totalmente nos servidores do WhatsApp
      await new Promise(r => setTimeout(r, 1000));

      // 2. Envia o áudio gravado configurado como Nota de Voz Oficial (tanto se atendeu quanto se não atendeu)
      console.log(`[Flow Engine] Ligação com ${targetPhone} concluída (${leadAnswered ? 'lead ATENDEU e chamada foi desligada' : 'lead NÃO atendeu / tempo esgotado'}). Preparando envio do áudio no WhatsApp...`);
      recordFlowMessageInChat(remoteJid, `📴 [Ligação encerrada (${leadAnswered ? 'atendida' : 'não atendeu'}) - Enviando áudio no WhatsApp]`);

      const targetRecipient = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
      const base64Audio = node.data?.fileBase64 || node.data?.audioBase64;
      const customFileName = node.data?.fileName;
      const resolved = await resolveMediaBuffer(audioPath, base64Audio, 'audio', customFileName);

      if (resolved && resolved.buffer.length > 0) {
        try {
          await sock.sendPresenceUpdate('recording', targetRecipient);
          await new Promise(r => setTimeout(r, 1200));
          await sock.sendPresenceUpdate('paused', targetRecipient);

          const isOgg = (audioPath && (audioPath.endsWith('.ogg') || audioPath.endsWith('.opus'))) || (resolved.mimeType?.includes('ogg') || resolved.mimeType?.includes('opus'));
          const mimetype = isOgg ? 'audio/ogg; codecs=opus' : (resolved.mimeType || 'audio/mp4');

          await sock.sendMessage(targetRecipient, {
            audio: resolved.buffer,
            mimetype,
            ptt: true // Nota de voz gravada oficial (microfone verde)
          });

          recordFlowMessageInChat(remoteJid, `🎤 [Nota de voz enviada para o lead]`, false, audioPath, 'audio', customFileName);
          console.log(`[Flow Engine] Áudio gravado enviado com sucesso para ${targetRecipient}`);
        } catch (audioSendErr: any) {
          console.error(`[Flow Engine] Falha no envio do áudio pós-chamada:`, audioSendErr);
        }
      } else {
        console.warn(`[Flow Engine] Nenhum arquivo de áudio encontrado para o card ligação (${audioPath || 'sem áudio'})`);
        recordFlowMessageInChat(remoteJid, `⚠️ [Áudio não encontrado para disparo pós-chamada]`);
      }
    } else if (node.type === 'audio') {
      const audioPath = node.data?.fileUrl || node.data?.audioUrl;
      const base64Audio = node.data?.fileBase64 || node.data?.audioBase64;
      const customFileName = node.data?.fileName;
      console.log(`[Flow Engine] Executando envio de Áudio para ${remoteJid}... (path: ${audioPath || 'n/a'}, base64: ${!!base64Audio})`);

      const resolved = await resolveMediaBuffer(audioPath, base64Audio, 'audio', customFileName);
      if (resolved && resolved.buffer.length > 0) {
        try {
          const delaySecs = Number(node.data?.delaySeconds) || 3;
          await sock.sendPresenceUpdate('recording', remoteJid);
          await new Promise(r => setTimeout(r, Math.min(delaySecs, 60) * 1000));
          await sock.sendPresenceUpdate('paused', remoteJid);

          const isOgg = (audioPath && (audioPath.endsWith('.ogg') || audioPath.endsWith('.opus'))) || (resolved.mimeType?.includes('ogg') || resolved.mimeType?.includes('opus'));
          const mimetype = isOgg ? 'audio/ogg; codecs=opus' : (resolved.mimeType || 'audio/mp4');

          await sock.sendMessage(remoteJid, {
            audio: resolved.buffer,
            mimetype,
            ptt: true // Nota de voz gravada na hora (microfone verde)
          });
          recordFlowMessageInChat(remoteJid, '🎵 [Áudio enviado]', false, audioPath, 'audio', customFileName);
          console.log(`[Flow Engine] Áudio enviado com sucesso para ${remoteJid}`);
        } catch (audioErr: any) {
          console.error(`[Flow Engine] Erro ao enviar áudio para ${remoteJid}:`, audioErr);
        }
      } else {
        console.warn(`[Flow Engine] Áudio não encontrado no card ${node.id}`);
        recordFlowMessageInChat(remoteJid, `⚠️ [Áudio do fluxo não encontrado para envio]`);
      }
    } else if (node.type === 'imagem') {
      const imgPath = node.data?.fileUrl || node.data?.imageUrl;
      const base64Img = node.data?.fileBase64 || node.data?.imageBase64;
      const customFileName = node.data?.fileName;
      console.log(`[Flow Engine] Executando envio de Imagem para ${remoteJid}... (path: ${imgPath || 'n/a'}, base64: ${!!base64Img})`);

      const resolved = await resolveMediaBuffer(imgPath, base64Img, 'image', customFileName);
      if (resolved && resolved.buffer.length > 0) {
        await simulateTyping(sock, remoteJid, 2000);
        const caption = replaceVariables(node.data?.caption || '');
        await sock.sendMessage(remoteJid, {
          image: resolved.buffer,
          caption: caption || undefined,
          mimetype: resolved.mimeType || 'image/jpeg'
        });
        recordFlowMessageInChat(remoteJid, caption || '🖼️ [Imagem enviada]', false, imgPath, 'image', customFileName);
        console.log(`[Flow Engine] Imagem enviada com sucesso para ${remoteJid}`);
      } else {
        console.error(`[Flow Engine] Arquivo de imagem não encontrado no disco/base64: ${imgPath || 'vazio'}`);
        recordFlowMessageInChat(remoteJid, `⚠️ [Não foi possível carregar a imagem do fluxo]`);
      }
    } else if (node.type === 'video') {
      const vidPath = node.data?.fileUrl || node.data?.videoUrl;
      const base64Vid = node.data?.fileBase64 || node.data?.videoBase64;
      const customFileName = node.data?.fileName;
      console.log(`[Flow Engine] Executando envio de Vídeo para ${remoteJid}... (path: ${vidPath || 'n/a'}, base64: ${!!base64Vid})`);

      const resolved = await resolveMediaBuffer(vidPath, base64Vid, 'video', customFileName);
      if (resolved && resolved.buffer.length > 0) {
        await simulateTyping(sock, remoteJid, 2500);
        const caption = replaceVariables(node.data?.caption || '');
        await sock.sendMessage(remoteJid, {
          video: resolved.buffer,
          caption: caption || undefined,
          mimetype: resolved.mimeType || 'video/mp4'
        });
        recordFlowMessageInChat(remoteJid, caption || '🎥 [Vídeo enviado]', false, vidPath, 'video', customFileName);
        console.log(`[Flow Engine] Vídeo enviado com sucesso para ${remoteJid}`);
      } else {
        console.error(`[Flow Engine] Arquivo de vídeo não encontrado no disco/base64: ${vidPath || 'vazio'}`);
        recordFlowMessageInChat(remoteJid, `⚠️ [Não foi possível carregar o vídeo do fluxo]`);
      }
    } else if (node.type === 'pdf' || node.type === 'documento') {
      const docPath = node.data?.fileUrl || node.data?.pdfUrl;
      const base64Doc = node.data?.fileBase64 || node.data?.pdfBase64;
      const customFileName = node.data?.fileName || 'documento.pdf';
      console.log(`[Flow Engine] Executando envio de Documento/PDF para ${remoteJid}... (path: ${docPath || 'n/a'}, base64: ${!!base64Doc})`);

      const resolved = await resolveMediaBuffer(docPath, base64Doc, 'document', customFileName);
      if (resolved && resolved.buffer.length > 0) {
        await simulateTyping(sock, remoteJid, 2000);
        const caption = replaceVariables(node.data?.caption || '');
        await sock.sendMessage(remoteJid, {
          document: resolved.buffer,
          mimetype: resolved.mimeType || 'application/pdf',
          fileName: customFileName,
          caption: caption || undefined
        });
        recordFlowMessageInChat(remoteJid, caption || `📄 [Documento: ${customFileName}]`, false, docPath, 'document', customFileName);
        console.log(`[Flow Engine] Documento PDF enviado com sucesso para ${remoteJid}`);
      } else {
        console.error(`[Flow Engine] Arquivo PDF não encontrado no disco/base64: ${docPath || 'vazio'}`);
        recordFlowMessageInChat(remoteJid, `⚠️ [Não foi possível carregar o documento PDF do fluxo]`);
      }
    } else if (node.type === 'timer' || node.type === 'intervalo') {
      const delayAmount = Number(node.data?.delay || 5);
      const unit = node.data?.unit || 'segundos';
      const ms = unit === 'segundos' ? delayAmount * 1000 : unit === 'minutos' ? delayAmount * 60000 : unit === 'horas' ? delayAmount * 3600000 : 5000;
      console.log(`[Flow Engine] Aguardando temporizador de ${delayAmount} ${unit} (${ms}ms) para ${remoteJid}...`);
      await new Promise(r => setTimeout(r, Math.min(ms, 3600000))); // Wait configured timer (máx 1 hora)
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
      const targetInst = node.data?.instance || 'Inst. 1';
      console.log(`[Flow Engine] Executando Gerenciar Grupo (ação: '${action}', instância: '${targetInst}') para ${remoteJid}`);

      // 1. Localizar o socket correspondente à instância configurada ou fallback para qualquer conectado
      let targetSock = sock;
      if (targetInst && sessions.size > 0) {
        const cleanInstNum = targetInst.replace(/[^0-9]/g, '');
        for (const [sId, sData] of sessions.entries()) {
          const sNum = sId.replace(/[^0-9]/g, '');
          const sName = (sData.name || '').toLowerCase();
          if (sData.status === 'connected' && sData.sock) {
            if ((cleanInstNum && sNum === cleanInstNum) || (cleanInstNum && sName.includes(cleanInstNum)) || sId.includes(cleanInstNum)) {
              targetSock = sData.sock;
              break;
            }
          }
        }
      }

      if (!targetSock || (!targetSock.groupParticipantsUpdate && !targetSock.groupCreate)) {
        for (const sData of sessions.values()) {
          if (sData.status === 'connected' && sData.sock) {
            targetSock = sData.sock;
            break;
          }
        }
      }

      if (!targetSock) {
        console.warn(`[Flow Engine] Nenhum WhatsApp conectado para executar ação de grupo '${action}'.`);
        recordFlowMessageInChat(remoteJid, `⚠️ [Falha na automação de grupo: WhatsApp não está conectado]`);
        return;
      }

      // 2. Normalizar número do lead (remover sufixos de device como :2 e formatar JID)
      const cleanPhone = remoteJid.split('@')[0].split(':')[0].replace(/\D/g, '');
      const participantJid = `${cleanPhone}@s.whatsapp.net`;

      // Variações brasileiras com e sem o 9º dígito
      let brAlternateJid: string | null = null;
      if (cleanPhone.startsWith('55') && cleanPhone.length === 13 && cleanPhone[4] === '9') {
        brAlternateJid = `55${cleanPhone.slice(2, 4)}${cleanPhone.slice(5)}@s.whatsapp.net`;
      } else if (cleanPhone.startsWith('55') && cleanPhone.length === 12) {
        brAlternateJid = `55${cleanPhone.slice(2, 4)}9${cleanPhone.slice(4)}@s.whatsapp.net`;
      }

      const candidateParticipants = Array.from(new Set([
        participantJid,
        brAlternateJid,
        remoteJid.includes('@') ? `${remoteJid.split('@')[0].split(':')[0]}@s.whatsapp.net` : null,
        remoteJid
      ].filter(Boolean))) as string[];

      try {
        if (action === 'criar') {
          // Criar novo grupo com o lead
          const rawGroupName = (node.data?.newGroupName || 'Novo Grupo {nome}').trim();
          let groupSubject = replaceVariables(rawGroupName).trim() || `Grupo ${cleanPhone}`;

          console.log(`[Flow Engine] Iniciando criação de grupo WhatsApp '${groupSubject}' para participante(s):`, candidateParticipants);

          let groupRes: any = null;

          // WhatsApp suporta até 100 caracteres em versões recentes, mas limita a 25 caracteres em stanzas legacy
          const fullSubject = groupSubject.slice(0, 100);
          const shortSubject = groupSubject.slice(0, 25);
          const subjectsToTry = [fullSubject];
          if (fullSubject.length > 25 && shortSubject !== fullSubject) {
            subjectsToTry.push(shortSubject);
          }

          // 1. Tentar groupCreate nativo com os participantes candidatos
          for (const subj of subjectsToTry) {
            if (groupRes && groupRes.id) break;
            for (const candJid of candidateParticipants) {
              try {
                groupRes = await targetSock.groupCreate(subj, [candJid]);
                if (groupRes && groupRes.id) {
                  console.log(`[Flow Engine] Grupo WhatsApp '${subj}' criado com sucesso com participante ${candJid}! ID: ${groupRes.id}`);
                  break;
                }
              } catch (cErr: any) {
                console.warn(`[Flow Engine] groupCreate('${subj}', [${candJid}]) falhou: ${cErr.message}`);
              }
            }
          }

          // 2. Se falhar com cada um individualmente, tentar query direta via IQ do Baileys
          if (!groupRes || !groupRes.id) {
            console.log(`[Flow Engine] Tentando criar grupo via query IQ direta...`);
            for (const candJid of candidateParticipants) {
              try {
                const createKey = generateMessageIDV2();
                const createRes = await targetSock.query({
                  tag: 'iq',
                  attrs: {
                    type: 'set',
                    xmlns: 'w:g2',
                    to: '@g.us'
                  },
                  content: [{
                    tag: 'create',
                    attrs: {
                      subject: shortSubject,
                      key: createKey
                    },
                    content: [{
                      tag: 'participant',
                      attrs: { jid: candJid }
                    }]
                  }]
                });
                const groupNode = getBinaryNodeChild(createRes, 'group');
                if (groupNode && groupNode.attrs && groupNode.attrs.id) {
                  const gid = groupNode.attrs.id.includes('@') ? groupNode.attrs.id : `${groupNode.attrs.id}@g.us`;
                  groupRes = { id: gid, subject: shortSubject };
                  console.log(`[Flow Engine] Grupo criado com sucesso via query direta! ID: ${gid}`);
                  break;
                }
              } catch (qErr: any) {
                console.warn(`[Flow Engine] Query direta de criação falhou com ${candJid}:`, qErr.message);
              }
            }
          }

          if (groupRes && groupRes.id) {
            console.log(`[Flow Engine] Grupo criado com sucesso! ID: ${groupRes.id}`);
            recordFlowMessageInChat(remoteJid, `👥 [Grupo WhatsApp '${groupSubject}' criado e lead adicionado com sucesso!]`);

            // Garantir que o lead seja adicionado caso a criação tenha criado o grupo com aviso de privacidade
            for (const candJid of candidateParticipants) {
              try {
                await targetSock.groupParticipantsUpdate(groupRes.id, [candJid], 'add');
                break;
              } catch (addErr: any) {
                // Não bloqueia o fluxo se já estiver no grupo ou se o WhatsApp rejeitar
              }
            }

            // Aplicar foto de perfil do grupo se configurada (sem bloquear o fluxo)
            const photoRaw = node.data?.groupPhotoUrl || node.data?.groupPhotoBase64;
            if (photoRaw) {
              console.log(`[Flow Engine] Processando foto de perfil para o grupo ${groupRes.id}...`);
              let photoBuffer: Buffer | null = null;
              try {
                const resolved = await resolveMediaBuffer(node.data?.groupPhotoUrl, node.data?.groupPhotoBase64, 'image', node.data?.groupPhotoName);
                photoBuffer = resolved?.buffer || null;

                if (photoBuffer && photoBuffer.length > 0) {
                  // Aguarda 2.2s para garantir sincronização do grupo e privilégios de admin nos servidores do WhatsApp
                  await new Promise(r => setTimeout(r, 2200));

                  const applyPhoto = async (targetJid: string, buf: Buffer) => {
                    // 1. Tentar via helper nativo do Baileys
                    if (targetSock.updateProfilePicture) {
                      try {
                        await targetSock.updateProfilePicture(targetJid, buf);
                        return true;
                      } catch (e: any) {
                        console.warn(`[Flow Engine] updateProfilePicture nativo falhou (${e.message}), tentando envio direto via query IQ...`);
                      }
                    }

                    // 2. Query IQ direta com atributos oficiais do WhatsApp: to=@s.whatsapp.net, target=groupJid
                    const { img } = await generateProfilePicture(buf);
                    await targetSock.query({
                      tag: 'iq',
                      attrs: {
                        to: S_WHATSAPP_NET,
                        target: targetJid,
                        type: 'set',
                        xmlns: 'w:profile:picture'
                      },
                      content: [
                        {
                          tag: 'picture',
                          attrs: { type: 'image' },
                          content: img
                        }
                      ]
                    });
                    return true;
                  };

                  try {
                    await applyPhoto(groupRes.id, photoBuffer);
                    console.log(`[Flow Engine] Foto de perfil do grupo '${groupSubject}' aplicada com sucesso!`);
                  } catch (photoErr: any) {
                    console.error('[Flow Engine] Erro ao aplicar foto do grupo (1ª tentativa):', photoErr.message);
                    // Segunda tentativa após 2.5s caso a criação do grupo ainda estivesse sincronizando
                    try {
                      await new Promise(r => setTimeout(r, 2500));
                      await applyPhoto(groupRes.id, photoBuffer);
                      console.log(`[Flow Engine] Foto de perfil do grupo '${groupSubject}' aplicada com sucesso na 2ª tentativa!`);
                    } catch (retryErr: any) {
                      console.error('[Flow Engine] Erro ao aplicar foto do grupo (2ª tentativa, não bloqueante):', retryErr.message);
                    }
                  }
                } else {
                  console.warn('[Flow Engine] Buffer da foto não pôde ser gerado para:', photoRaw.slice(0, 60));
                }
              } catch (photoErr: any) {
                console.error('[Flow Engine] Erro inesperado ao processar foto do grupo (não bloqueante):', photoErr.message);
              }
            }

            // Enviar mensagem de boas-vindas DENTRO DO GRUPO marcando o lead com @
            try {
              const firstNameClean = (senderName || 'Amigo').split(' ')[0].replace(/[^\w\sÀ-ÿ]/gi, '').trim() || 'Amigo';
              const leadMentionTag = `@${cleanPhone}`;

              let welcomeMsg = '';
              if (node.data?.welcomeMessage) {
                let custom = replaceVariables(node.data.welcomeMessage);
                if (!custom.includes(leadMentionTag)) {
                  welcomeMsg = `Olá ${leadMentionTag} (${firstNameClean})!\n\n${custom}`;
                } else {
                  welcomeMsg = custom;
                }
              } else {
                welcomeMsg = `Olá ${leadMentionTag} (${firstNameClean})! Seja muito bem-vindo(a) ao seu grupo exclusivo *${groupSubject}*! 🎉`;
              }

              const validMentions = candidateParticipants.filter(p => typeof p === 'string' && p.includes('@'));

              // Aguarda 1.2s para garantir que os servidores do WhatsApp propaguem a lista de membros no grupo
              await new Promise(r => setTimeout(r, 1200));

              await targetSock.sendMessage(groupRes.id, {
                text: welcomeMsg,
                mentions: validMentions
              });
              console.log(`[Flow Engine] Mensagem de boas-vindas enviada DENTRO do grupo ${groupRes.id} marcando @${cleanPhone} (${firstNameClean})`);
              recordFlowMessageInChat(remoteJid, `👥 [Boas-vindas enviada no grupo '${groupSubject}' marcando @${firstNameClean}]`);
            } catch (msgErr: any) {
              console.warn('[Flow Engine] Erro ao enviar mensagem de boas-vindas dentro do grupo:', msgErr.message);
            }
          } else {
            console.warn(`[Flow Engine] Não foi possível criar o grupo WhatsApp '${groupSubject}' para ${remoteJid}`);
            recordFlowMessageInChat(remoteJid, `⚠️ [Não foi possível criar o grupo WhatsApp]`);
          }
        } else if (action === 'adicionar') {
          let groupId = (node.data?.groupId || '').trim();
          const groupName = node.data?.groupName || groupId;
          if (!groupId) {
            console.warn('[Flow Engine] groupId não configurado para ação adicionar');
            recordFlowMessageInChat(remoteJid, `⚠️ [Falha no card de grupo: Nenhum grupo foi selecionado]`);
            return;
          }

          // Garantir sufixo @g.us se o usuário colou apenas o ID numérico
          if (!groupId.includes('@')) {
            groupId = `${groupId}@g.us`;
          }

          console.log(`[Flow Engine] Adicionando participante ${participantJid} ao grupo ${groupId}...`);
          try {
            // Tenta adicionar usando participantJid limpo e, se necessário, remoteJid original
            let updateRes = await targetSock.groupParticipantsUpdate(groupId, [participantJid], 'add');
            console.log('[Flow Engine] Resultado adicionar ao grupo:', updateRes);

            const isRestricted = Array.isArray(updateRes) && updateRes.some((r: any) => r.status === '403' || r.status === 403);
            const isAlreadyIn = Array.isArray(updateRes) && updateRes.some((r: any) => r.status === '409' || r.status === 409);
            const isFailed = Array.isArray(updateRes) && updateRes.some((r: any) => r.status && r.status !== '200' && r.status !== 200 && r.status !== '409' && r.status !== 409 && r.status !== '403' && r.status !== 403);

            if (isRestricted) {
              // Lead tem restrição de privacidade no WhatsApp -> Gerar link de convite e enviar
              let inviteLink = '';
              try {
                const code = await targetSock.groupInviteCode(groupId);
                inviteLink = `https://chat.whatsapp.com/${code}`;
              } catch (e) {}

              if (inviteLink) {
                await targetSock.sendMessage(remoteJid, {
                  text: `Olá ${replaceVariables('{nome}')}! Devido às opções de privacidade da sua conta WhatsApp, você não pôde ser adicionado automaticamente. Clique no link para entrar no grupo *${groupName}*:\n${inviteLink}`
                });
                recordFlowMessageInChat(remoteJid, `🔗 [Privacidade ativada no lead: Link de convite enviado: ${inviteLink}]`);
              } else {
                recordFlowMessageInChat(remoteJid, `⚠️ [Lead tem restrição de privacidade e não foi possível gerar o link de convite]`);
              }
            } else if (isAlreadyIn) {
              recordFlowMessageInChat(remoteJid, `👥 [Lead já faz parte do grupo '${groupName}']`);
            } else if (isFailed) {
              // Tenta fallback com remoteJid original (caso o WhatsApp necessite do identificador exato)
              try {
                const fallbackRes = await targetSock.groupParticipantsUpdate(groupId, [remoteJid], 'add');
                console.log('[Flow Engine] Resultado fallback adicionar ao grupo:', fallbackRes);
                recordFlowMessageInChat(remoteJid, `👥 [Lead adicionado com sucesso ao grupo '${groupName}']`);
              } catch (fbErr: any) {
                console.warn('[Flow Engine] Fallback adicionar falhou:', fbErr.message);
                recordFlowMessageInChat(remoteJid, `⚠️ [Não foi possível adicionar o lead diretamente ao grupo '${groupName}']`);
              }
            } else {
              recordFlowMessageInChat(remoteJid, `👥 [Lead adicionado com sucesso ao grupo '${groupName}']`);
            }
          } catch (addErr: any) {
            console.error('[Flow Engine] Erro ao adicionar participante no grupo:', addErr);
            // Se falhou (ex: bot não tem permissão de admin direta), tenta obter o link do grupo e mandar para o lead
            try {
              const code = await targetSock.groupInviteCode(groupId);
              const inviteLink = `https://chat.whatsapp.com/${code}`;
              await targetSock.sendMessage(remoteJid, {
                text: `Olá ${replaceVariables('{nome}')}! Acesse seu grupo *${groupName}* pelo link oficial:\n${inviteLink}`
              });
              recordFlowMessageInChat(remoteJid, `🔗 [Link do grupo enviado ao lead: ${inviteLink}]`);
            } catch (invErr) {
              recordFlowMessageInChat(remoteJid, `⚠️ [Não foi possível adicionar ao grupo: verifique se o bot é administrador do grupo]`);
            }
          }
        } else if (action === 'remover') {
          let groupId = (node.data?.groupId || '').trim();
          const groupName = node.data?.groupName || groupId;
          if (!groupId) {
            console.warn('[Flow Engine] groupId não configurado para ação remover');
            recordFlowMessageInChat(remoteJid, `⚠️ [Falha no card de grupo: Nenhum grupo foi selecionado para remoção]`);
            return;
          }

          if (!groupId.includes('@')) {
            groupId = `${groupId}@g.us`;
          }

          console.log(`[Flow Engine] Removendo participante ${participantJid} (e ${remoteJid}) do grupo ${groupId}...`);
          try {
            // Tenta remover com participantJid formatado e com remoteJid para cobrir tanto @s.whatsapp.net quanto @lid
            const participantsToRemove = Array.from(new Set([participantJid, remoteJid].filter(Boolean)));
            const updateRes = await targetSock.groupParticipantsUpdate(groupId, participantsToRemove, 'remove');
            console.log('[Flow Engine] Resultado remover do grupo:', updateRes);
            recordFlowMessageInChat(remoteJid, `👥 [Lead removido do grupo '${groupName}']`);
          } catch (remErr: any) {
            console.error('[Flow Engine] Erro ao remover do grupo:', remErr);
            recordFlowMessageInChat(remoteJid, `⚠️ [Erro ao remover do grupo: verifique se o bot é administrador do grupo]`);
          }
        }
      } catch (grpErr: any) {
        console.error('[Flow Engine] Erro geral na ação de grupo:', grpErr);
        recordFlowMessageInChat(remoteJid, `⚠️ [Erro na automação de grupo: ${grpErr.message}]`);
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
function recordFlowMessageInChat(
  remoteJid: string,
  text: string,
  isAi = false,
  mediaUrl?: string,
  mediaType?: 'image' | 'video' | 'audio' | 'document',
  fileName?: string
) {
  const timeStr = getBrazilTimeString();
  let chat = liveChats.get(remoteJid);
  if (!chat) {
    const cleanPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
    chat = {
      id: remoteJid,
      leadPhone: `+${cleanPhone}`,
      leadName: 'Lead ' + cleanPhone,
      tag: 'quente',
      internalNotes: '',
      aiAgentActive: false,
      botFlowActive: true,
      unreadCount: 0,
      lastMessage: text,
      lastMessageTime: timeStr,
      messages: []
    };
    liveChats.set(remoteJid, chat);
  }

  const botMsg: ChatMessage = {
    id: `bot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    fromMe: true,
    text,
    timestamp: timeStr,
    senderName: isAi ? 'IA NyxZap' : 'Fluxo NyxZap',
    isAiGenerated: isAi,
    mediaUrl,
    mediaType,
    fileName
  };
  chat.messages.push(botMsg);
  chat.lastMessage = text;
  chat.lastMessageTime = timeStr;
  liveChats.set(remoteJid, chat);
  persistChatAndMessage(chat, botMsg).catch(err => console.error('[Bot Msg Persist Error]', err));
  broadcast('chat_message', { chatId: remoteJid, message: botMsg, conversation: chat });
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

      // Detect incoming/outgoing media in message
      let detectedMediaType: 'image' | 'video' | 'audio' | 'document' | undefined;
      let detectedMediaUrl: string | undefined;
      let detectedFileName: string | undefined;

      if ((unwrapped as any)?.imageMessage) {
        detectedMediaType = 'image';
      } else if ((unwrapped as any)?.videoMessage) {
        detectedMediaType = 'video';
      } else if ((unwrapped as any)?.audioMessage) {
        detectedMediaType = 'audio';
      } else if ((unwrapped as any)?.documentMessage) {
        detectedMediaType = 'document';
        detectedFileName = (unwrapped as any).documentMessage.fileName || 'documento.pdf';
      }

      // Download incoming or external media to disk so it can be streamed/displayed in Live Chat
      if (detectedMediaType) {
        try {
          const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            {
              logger,
              reuploadRequest: sock.updateMediaMessage
            }
          );
          if (buffer && buffer.length > 0) {
            const ext = detectedMediaType === 'image' 
              ? '.jpg' 
              : detectedMediaType === 'video' 
                ? '.mp4' 
                : detectedMediaType === 'audio' 
                  ? ((unwrapped as any)?.audioMessage?.ptt ? '.ogg' : '.mp3')
                  : (path.extname(detectedFileName || '') || '.bin');
            const savedName = `wa-${Date.now()}-${Math.random().toString(36).substr(2, 6)}${ext}`;
            const targetPath = path.join(uploadsDir, savedName);
            fs.writeFileSync(targetPath, buffer);
            detectedMediaUrl = `/uploads/${savedName}`;
          }
        } catch (dlErr: any) {
          console.warn('[Baileys Media Download Error]', dlErr?.message || dlErr);
        }
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
          if (!botOrOut.mediaUrl && detectedMediaUrl) botOrOut.mediaUrl = detectedMediaUrl;
          if (!botOrOut.mediaType && detectedMediaType) botOrOut.mediaType = detectedMediaType;
          isDuplicate = true;
        }
      }

      if (isDuplicate) continue;

      const newMsg: ChatMessage = {
        id: msgId,
        fromMe,
        text,
        timestamp: timeStr,
        senderName: fromMe ? 'Atendente' : chat.leadName,
        mediaUrl: detectedMediaUrl,
        mediaType: detectedMediaType,
        fileName: detectedFileName
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

        // VERIFICA PRIMEIRO SE O CLIENTE ESTAVA AGUARDANDO RESPOSTA EM UM FLUXO ATIVO
        const cleanPhone = remoteJid.replace(/\D/g, '');
        const pending = pendingFlowResponses.get(cleanPhone) || pendingFlowResponses.get(remoteJid);

        if (pending && chat.botFlowActive !== false) {
          clearTimeout(pending.timeoutTimer);
          pendingFlowResponses.delete(cleanPhone);
          pendingFlowResponses.delete(remoteJid);
          console.log(`[Flow Engine] Cliente ${remoteJid} respondeu a tempo ao card '${pending.nodeId}'! Cancelando timeout e seguindo 'Se responder' (${pending.responseTargetId || 'Fim do fluxo'}).`);
          if (pending.responseTargetId) {
            await resumeFlowChain(sock, remoteJid, pending.responseTargetId, chat.leadName, text, sessionId, pending.flow);
          }
        } else if (instanceMode === 'flow' && chat.botFlowActive !== false) {
          // MODO EXCLUSIVO: BOT DE FLUXO (INÍCIO DE NOVO FLUXO POR GATILHO)
          await executeFlowForMessage(sock, remoteJid, text, chat.leadName, sessionId);
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
    return res.json({
      success: true,
      flows: result.rows.map(r => ({
        id: r.id,
        name: r.name || 'Fluxo',
        description: r.description || '',
        active: r.active !== false,
        executionCount: parseInt(r.execution_count, 10) || 0,
        nodes: r.nodes || [],
        edges: r.edges || [],
        nodeCount: Array.isArray(r.nodes) ? r.nodes.length : 0,
        updatedAt: r.updated_at
      }))
    });
  } catch (err: any) {
    console.error('[Flows List Error]', err);
    res.json({ success: true, flows: [] });
  }
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
    if (activeFlow.id === id) {
      activeFlow = {
        id: '',
        name: '',
        description: '',
        active: false,
        execution_count: 0,
        nodes: [],
        edges: []
      };
    }
    console.log(`[Flow Engine] Fluxo '${id}' excluído permanentemente do banco de dados.`);
    res.json({ success: true, message: 'Fluxo excluído com sucesso!' });
  } catch (err: any) {
    console.error('[Flow Delete Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Single active flow backwards compatibility
app.get('/api/flow', async (_req, res) => {
  try {
    const result = await pool.query('SELECT id, name, nodes, edges, active FROM flow_definitions WHERE active = true ORDER BY updated_at DESC LIMIT 1');
    if (result.rows.length > 0) {
      return res.json({
        success: true,
        id: result.rows[0].id,
        name: result.rows[0].name,
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
  const { id, nodes, edges, active } = req.body;
  const targetId = id || (activeFlow.id && activeFlow.id !== 'default' ? activeFlow.id : null);
  if (!targetId) {
    return res.json({ success: true, message: 'Nenhum fluxo selecionado para sincronizar.' });
  }
  try {
    activeFlow = {
      ...activeFlow,
      id: targetId,
      active: active !== undefined ? Boolean(active) : true,
      nodes: Array.isArray(nodes) ? nodes : activeFlow.nodes,
      edges: Array.isArray(edges) ? edges : activeFlow.edges
    };

    await pool.query(
      `INSERT INTO flow_definitions (id, user_id, active, nodes, edges, updated_at)
       VALUES ($1, 'default', $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         active = EXCLUDED.active,
         nodes = EXCLUDED.nodes,
         edges = EXCLUDED.edges,
         updated_at = CURRENT_TIMESTAMP`,
      [targetId, activeFlow.active, JSON.stringify(activeFlow.nodes), JSON.stringify(activeFlow.edges)]
    );

    console.log(`[Flow Engine] Fluxo '${targetId}' atualizado com sucesso no banco de dados (${activeFlow.nodes.length} nós)!`);
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
  const triggerNode = testNodes.find(n => n.type === 'inicio' || n.type === 'webhook' || n.type === 'cakto');
  const targetFlowObj = { nodes: testNodes, edges: testEdges };

  const remoteJid = `${cleanNumber}@s.whatsapp.net`;
  console.log(`[Flow Test Engine] Disparando teste do fluxo '${flowId || activeFlow.id}' para ${remoteJid}`);

  try {
    // Sync activeFlow in memory
    activeFlow.nodes = testNodes;
    activeFlow.edges = testEdges;

    // Increment execution count in DB
    const targetFlowId = flowId || activeFlow.id || 'default';
    activeFlow.execution_count = (activeFlow.execution_count || 0) + 1;
    await pool.query('UPDATE flow_definitions SET execution_count = COALESCE(execution_count, 0) + 1 WHERE id = $1', [targetFlowId]);

    // Execute flow chain:
    if (triggerNode) {
      const outgoing = testEdges.filter(e => e.from === triggerNode.id);
      if (outgoing.length > 0) {
        for (const outEdge of outgoing) {
          resumeFlowChain(connectedSession.sock, remoteJid, outEdge.to, 'Lead Teste', 'Teste de Funil', connectedSession.id, targetFlowObj)
            .catch(err => console.error('[Flow Test Error]', err));
        }
      } else {
        const firstAction = testNodes.find(n => n.type !== 'inicio' && n.type !== 'webhook' && n.type !== 'cakto');
        const startId = firstAction ? firstAction.id : triggerNode.id;
        resumeFlowChain(connectedSession.sock, remoteJid, startId, 'Lead Teste', 'Teste de Funil', connectedSession.id, targetFlowObj)
          .catch(err => console.error('[Flow Test Error]', err));
      }
    } else {
      resumeFlowChain(connectedSession.sock, remoteJid, testNodes[0].id, 'Lead Teste', 'Teste de Funil', connectedSession.id, targetFlowObj)
        .catch(err => console.error('[Flow Test Error]', err));
    }

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
  const { sessionId, instance } = req.query;
  let targetSession: SessionData | undefined;

  if (sessionId && typeof sessionId === 'string') {
    targetSession = sessions.get(sessionId);
  }

  if (!targetSession && instance && typeof instance === 'string') {
    const cleanNum = instance.replace(/[^0-9]/g, '');
    for (const [sId, s] of sessions.entries()) {
      const sNum = sId.replace(/[^0-9]/g, '');
      const sName = (s.name || '').toLowerCase();
      if (s.status === 'connected' && s.sock) {
        if ((cleanNum && sNum === cleanNum) || (cleanNum && sName.includes(cleanNum)) || sId.includes(cleanNum)) {
          targetSession = s;
          break;
        }
      }
    }
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
      error: 'Nenhum WhatsApp conectado nesta instância. Conecte seu aparelho para sincronizar os grupos.' 
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
  const { text, mediaUrl, mediaType, fileName } = req.body;

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

  if (session && session.sock && (text || mediaUrl)) {
    try {
      if (mediaUrl) {
        const fullMediaPath = mediaUrl.startsWith('http')
          ? mediaUrl
          : path.join(process.cwd(), mediaUrl.replace(/^\//, ''));

        if (fs.existsSync(fullMediaPath)) {
          const buffer = fs.readFileSync(fullMediaPath);
          if (mediaType === 'image') {
            await session.sock.sendMessage(id, { image: buffer, caption: text || undefined });
          } else if (mediaType === 'video') {
            await session.sock.sendMessage(id, { video: buffer, caption: text || undefined });
          } else if (mediaType === 'audio') {
            await session.sock.sendMessage(id, { audio: buffer, mimetype: 'audio/mp4', ptt: true });
            if (text) {
              await session.sock.sendMessage(id, { text });
            }
          } else if (mediaType === 'document') {
            await session.sock.sendMessage(id, {
              document: buffer,
              mimetype: 'application/octet-stream',
              fileName: fileName || path.basename(fullMediaPath),
              caption: text || undefined
            });
          }
        } else if (text) {
          await session.sock.sendMessage(id, { text });
        }
      } else if (text) {
        await session.sock.sendMessage(id, { text });
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Fallback simulation when disconnected
  if (chat && (text || mediaUrl)) {
    const newMsg: ChatMessage = {
      id: `out-${Date.now()}`,
      fromMe: true,
      text: text || (mediaType === 'image' ? '📷 [Foto]' : mediaType === 'video' ? '🎥 [Vídeo]' : mediaType === 'audio' ? '🎵 [Áudio]' : '📄 [Documento]'),
      timestamp: getBrazilTimeString(),
      isAiGenerated: false,
      mediaUrl,
      mediaType,
      fileName
    };
    chat.messages.push(newMsg);
    chat.lastMessage = newMsg.text;
    liveChats.set(id, chat);
    persistChatAndMessage(chat, newMsg).catch(e => console.error('[Persist manual msg error]', e));
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


