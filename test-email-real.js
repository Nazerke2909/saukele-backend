import { env } from './src/config/env.js';
import nodemailer from 'nodemailer';

console.log(`[TEST] Connecting to ${env.SMTP_HOST}:${env.SMTP_PORT}`);
console.log(`[TEST] User: ${env.SMTP_USER}`);
console.log(`[TEST] From: ${env.SMTP_FROM}`);

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

try {
  const info = await transporter.sendMail({
    from: `"Saukele" <${env.SMTP_FROM}>`,
    to: env.SMTP_USER, // пробуем отправить самому себе
    subject: '✅ Real SMTP Test — Saukele',
    html: '<h1>✅ Реальная отправка работает!</h1><p>Письмо отправлено через Mailgun SMTP.</p>',
  });

  console.log('[TEST] ✅ Sent:', info.messageId);
  console.log('[TEST] Response:', info.response);
} catch (err) {
  console.error('[TEST] ❌ Failed:', err.message);
}

await transporter.close();
