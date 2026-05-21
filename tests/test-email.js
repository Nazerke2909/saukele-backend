import { env } from './src/config/env.js';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

console.log(`[TEST] Connecting to ${env.SMTP_HOST}:${env.SMTP_PORT}`);

try {
  const info = await transporter.sendMail({
    from: `"Saukele" <${env.SMTP_FROM}>`,
    to: 'ВАШ_EMAIL@example.com', // поменяйте на свой
    subject: 'Test SMTP Saukele',
    html: '<h1>✅ Работает!</h1>',
  });

  console.log('[TEST] ✅ Sent:', info.messageId);
  console.log('[TEST] Response:', info.response);
} catch (err) {
  console.error('[TEST] ❌', err.message);
}

await transporter.close();