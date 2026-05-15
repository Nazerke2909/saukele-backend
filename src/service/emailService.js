import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = nodemailer.createTransport({
  host: env.EMAIL_HOST || env.SMTP_HOST || 'smtp.ethereal.email',
  port: env.SMTP_PORT || 587,
  secure: env.SMTP_SECURE === 'true',
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export async function sendVerificationEmail(email, code) {
  const appUrl = env.APP_URL || 'http://localhost:3000';

  const info = await transporter.sendMail({
    from: `"Saukele" <${env.SMTP_FROM || 'noreply@saukele.kz'}>`,
    to: email,
    subject: 'Verify your email — Saukele',
    html: `
      <h1>Welcome to Saukele!</h1>
      <p>Your verification code is:</p>
      <h2 style="font-size: 32px; letter-spacing: 4px; color: #4CAF50;">${code}</h2>
      <p>Or click the link below:</p>
      <a href="${appUrl}/auth/verify-email?code=${code}&email=${encodeURIComponent(email)}"
         style="display:inline-block;padding:12px 24px;background:#4CAF50;color:white;text-decoration:none;border-radius:4px;">
        Verify Email
      </a>
      <p>This code expires in 1 hour.</p>
    `,
  });

  console.log(`[EMAIL] Verification email sent to ${email}: ${info.messageId}`);
  return info;
}

export async function sendVerificationLinkEmail(email, verifyToken) {
  const info = await transporter.sendMail({
    from: `"Saukele" <${env.SMTP_FROM || 'noreply@saukele.kz'}>`,
    to: email,
    subject: 'Verify your email — Saukele',
    html: `
      <h1>Welcome to Saukele!</h1>
      <p>Your verification code is:</p>
      <h2 style="font-size: 36px; letter-spacing: 8px; color: #4CAF50; text-align: center;">${verifyToken}</h2>
      <p>Enter this code on the verification page to confirm your email address.</p>
      <p>This code expires in 24 hours.</p>
      <p>If you did not register, please ignore this email.</p>
      <hr>
      <p style="color: #888;">Saukele — Wedding Gift Management</p>
    `,
  });

  console.log(`[EMAIL] Verification link sent to ${email}: ${info.messageId}`);
  return info;
}

export async function sendPasswordResetEmail(email, resetToken) {
  const appUrl = env.APP_URL || 'http://localhost:3000';

  const info = await transporter.sendMail({
    from: `"Saukele" <${env.SMTP_FROM || 'noreply@saukele.kz'}>`,
    to: email,
    subject: 'Password Reset — Saukele',
    html: `
      <h1>Password Reset Request</h1>
      <p>You requested to reset your password. Click the link below:</p>
      <a href="${appUrl}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}"
         style="display:inline-block;padding:12px 24px;background:#2196F3;color:white;text-decoration:none;border-radius:4px;">
        Reset Password
      </a>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  });

  console.log(`[EMAIL] Password reset email sent to ${email}: ${info.messageId}`);
  return info;
}

export async function sendContributionReceivedEmail(coupleEmail, coupleName, guestName, poolName, amountKzt) {
  const info = await transporter.sendMail({
    from: `"Saukele" <${env.SMTP_FROM || 'noreply@saukele.kz'}>`,
    to: coupleEmail,
    subject: `New contribution to "${poolName}" — Saukele`,
    html: `
      <h1>Hello ${coupleName}!</h1>
      <p><strong>${guestName}</strong> has contributed to your gift pool <strong>"${poolName}"</strong>.</p>
      <p style="font-size: 24px; color: #4CAF50;">${amountKzt.toLocaleString()} KZT</p>
      <p>View all contributions in your dashboard.</p>
      <hr>
      <p style="color: #888;">Saukele — Wedding Gift Management</p>
    `,
  });

  console.log(`[EMAIL] Contribution notification sent to ${coupleEmail}: ${info.messageId}`);
  return info;
}

export async function sendGiftObligationReminderEmail(memberEmail, memberName, weddingTitle, kinshipRank, obligationKzt, contributedKzt) {
  const remaining = obligationKzt - contributedKzt;
  const info = await transporter.sendMail({
    from: `"Saukele" <${env.SMTP_FROM || 'noreply@saukele.kz'}>`,
    to: memberEmail,
    subject: `Gift obligation reminder for "${weddingTitle}" — Saukele`,
    html: `
      <h1>Hello ${memberName}!</h1>
      <p>This is a reminder about your gift obligation for <strong>"${weddingTitle}"</strong>.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">Your kinship rank</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${kinshipRank}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">Expected gift</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${obligationKzt.toLocaleString()} KZT</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">Already contributed</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${contributedKzt.toLocaleString()} KZT</td>
        </tr>
        <tr>
          <td style="padding: 8px; color: ${remaining > 0 ? '#f44336' : '#4CAF50'}; font-weight: bold;">
            ${remaining > 0 ? 'Remaining' : 'Fulfilled'}
          </td>
          <td style="padding: 8px; font-weight: bold;">
            ${remaining > 0 ? `${remaining.toLocaleString()} KZT` : '✅ Complete!'}
          </td>
        </tr>
      </table>
      <p style="margin-top: 16px;">
        <a href="${env.FRONTEND_URL || env.APP_URL || 'http://localhost:3000'}/family/obligations"
           style="display:inline-block;padding:12px 24px;background:#4CAF50;color:white;text-decoration:none;border-radius:4px;">
          View My Obligations
        </a>
      </p>
      <hr>
      <p style="color: #888;">Saukele — Wedding Gift Management</p>
    `,
  });

  console.log(`[EMAIL] Obligation reminder sent to ${memberEmail}: ${info.messageId}`);
  return info;
}

export async function sendPoolFundedEmail(coupleEmail, coupleName, poolName, targetKzt, totalFundedKzt) {
  const info = await transporter.sendMail({
    from: `"Saukele" <${env.SMTP_FROM || 'noreply@saukele.kz'}>`,
    to: coupleEmail,
    subject: `"${poolName}" is fully funded! — Saukele`,
    html: `
      <h1>Congratulations ${coupleName}!</h1>
      <p>Your gift pool <strong>"${poolName}"</strong> has been fully funded!</p>
      <p style="font-size: 24px; color: #4CAF50;">
        ${totalFundedKzt.toLocaleString()} KZT of ${targetKzt.toLocaleString()} KZT
      </p>
      <p>You can now mark the pool as <strong>purchased</strong> and start using the funds.</p>
      <p style="margin-top: 16px;">
        <a href="${env.FRONTEND_URL || env.APP_URL || 'http://localhost:3000'}/pools/${poolName}"
           style="display:inline-block;padding:12px 24px;background:#2196F3;color:white;text-decoration:none;border-radius:4px;">
          Manage Pool
        </a>
      </p>
      <hr>
      <p style="color: #888;">Saukele — Wedding Gift Management</p>
    `,
  });

  console.log(`[EMAIL] Pool funded notification sent to ${coupleEmail}: ${info.messageId}`);
  return info;
}