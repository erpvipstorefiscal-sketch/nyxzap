import nodemailer from 'nodemailer';

/**
 * Hostinger SMTP Configuration
 * Servidor: smtp.hostinger.com
 * Porta: 465 (SSL)
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true, // SSL
  auth: {
    user: process.env.SMTP_USER || 'esqueceusenha@nyxzap.com.br',
    pass: process.env.SMTP_PASS || 'Runescape96019379@'
  },
  tls: {
    rejectUnauthorized: false
  }
});

interface SendRecoveryEmailParams {
  toEmail: string;
  userName: string;
  recoveryCode: string;
  resetLink: string;
}

export async function sendPasswordRecoveryEmail({
  toEmail,
  userName,
  recoveryCode,
  resetLink
}: SendRecoveryEmailParams): Promise<boolean> {
  const mailHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Recuperação de Senha - NyxZap</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090a0f; color: #f1f5f9; margin: 0; padding: 40px 10px; }
        .container { max-width: 560px; margin: 0 auto; background: #0f111a; border: 1px solid #1e293b; border-radius: 24px; padding: 36px 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
        .brand { text-align: center; margin-bottom: 24px; }
        .logo-badge { display: inline-block; background: linear-gradient(135deg, #9333ea, #6366f1); width: 48px; height: 48px; line-height: 48px; border-radius: 14px; font-size: 24px; color: #fff; font-weight: bold; margin-bottom: 8px; }
        .brand-title { font-size: 22px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: -0.5px; }
        .brand-sub { font-size: 12px; color: #94a3b8; margin-top: 4px; }
        .greeting { font-size: 15px; font-weight: 600; color: #e2e8f0; margin-bottom: 12px; }
        .text { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 20px; }
        .code-box { background: #151824; border: 1px dashed #7e22ce; border-radius: 14px; padding: 18px; text-align: center; margin: 24px 0; }
        .code-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #a855f7; font-weight: 700; display: block; margin-bottom: 6px; }
        .code-value { font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #ffffff; }
        .btn-wrapper { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background: linear-gradient(135deg, #9333ea, #7c3aed); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 20px rgba(147, 51, 234, 0.4); }
        .warning { font-size: 12px; color: #94a3b8; border-top: 1px solid #1e293b; padding-top: 18px; margin-top: 24px; }
        .footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="brand">
          <div class="logo-badge">⚡</div>
          <h1 class="brand-title">NyxZap</h1>
          <p class="brand-sub">Automação Inteligente, WhatsApp CRM & IA</p>
        </div>

        <div class="greeting">Olá, ${userName || 'Cliente'}!</div>
        <p class="text">
          Recebemos uma solicitação para redefinir a senha de acesso da sua conta no <strong>NyxZap</strong> associada ao e-mail <strong>${toEmail}</strong>.
        </p>

        <div class="code-box">
          <span class="code-label">Código de Verificação de Segurança</span>
          <span class="code-value">${recoveryCode}</span>
        </div>

        <p class="text" style="text-align: center; font-size: 13px;">
          Utilize o código acima diretamente na tela de recuperação ou clique no botão abaixo para prosseguir:
        </p>

        <div class="btn-wrapper">
          <a href="${resetLink}" class="btn" target="_blank">Redefinir Minha Senha</a>
        </div>

        <div class="warning">
          <strong>⚠️ Aviso de Segurança:</strong>
          <br>• Este código e link expiram em <strong>30 minutos</strong>.
          <br>• Se você não solicitou a recuperação, pode ignorar este e-mail com segurança. Sua senha atual permanecerá inalterada.
          <br>• A equipe NyxZap nunca solicitará sua senha por WhatsApp ou e-mail.
        </div>
      </div>

      <div class="footer">
        © 2026 NyxZap Inc. Todos os direitos reservados.<br>
        Enviado com criptografia segura através de esqueceusenha@nyxzap.com.br
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: '"NyxZap Segurança" <esqueceusenha@nyxzap.com.br>',
      to: toEmail,
      subject: `⚡ Código de Recuperação de Senha: ${recoveryCode} - NyxZap`,
      html: mailHtml,
      text: `Olá ${userName}! Seu código de verificação para redefinição de senha no NyxZap é: ${recoveryCode}. Acesse: ${resetLink} (válido por 30 minutos).`
    });

    console.log(`[Hostinger Mailer] E-mail de recuperação enviado com sucesso para ${toEmail}. MessageId: ${info.messageId}`);
    return true;
  } catch (error: any) {
    console.error(`[Hostinger Mailer Error] Falha ao enviar e-mail via Hostinger:`, error.message);
    throw error;
  }
}
