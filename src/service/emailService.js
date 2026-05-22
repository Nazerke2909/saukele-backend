import { env } from '../config/env.js';
import nodemailer from 'nodemailer';

const fromName = 'Saukele';

function createTransporter() {
  if (env.MAILGUN_API_KEY) {
    const isSandbox = env.MAILGUN_DOMAIN && env.MAILGUN_DOMAIN.includes('sandbox');
    const mailgunDomain = env.MAILGUN_DOMAIN || 'sandboxxxxxxxxxxxxxxxx.mailgun.org';
    
    const authUser = env.MAILGUN_SMTP_USER || `postmaster@${mailgunDomain}`;
    const authPass = env.MAILGUN_SMTP_PASSWORD || env.MAILGUN_SMTP_PASS || env.MAILGUN_API_KEY;

    console.log('[EMAIL] Initializing Mailgun SMTP transporter...');
    console.log(`[EMAIL]   Mode: ${isSandbox ? 'SANDBOX' : 'PRODUCTION'}`);
    console.log(`[EMAIL]   Domain: ${mailgunDomain}`);
    console.log(`[EMAIL]   Host: ${env.MAILGUN_SMTP_HOST || 'smtp.mailgun.org'}:${Number(env.MAILGUN_SMTP_PORT) || 587}`);
    console.log(`[EMAIL]   User: ${authUser}`);
    console.log(`[EMAIL]   Pass (first 8 chars): ${authPass.substring(0, 8)}...`);

    return nodemailer.createTransport({
      host: env.MAILGUN_SMTP_HOST || 'smtp.mailgun.org',
      port: Number(env.MAILGUN_SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: authUser,
        pass: authPass,
      },
    });
  }

  
  console.warn('[EMAIL] No MAILGUN_API_KEY configured — emails will not be sent');
  return null;
}

async function sendMail({ to, subject, html, from }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[EMAIL] Would send to ${to}: ${subject}`);
    return { id: 'dry-run' };
  }

  const mailOptions = {
    from: from || `${fromName} <${env.SMTP_FROM || 'noreply@saukele.kz'}>`,
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Sent to ${to}: ${info.messageId}`);
    return { id: info.messageId };
  } catch (error) {
    console.error(`[EMAIL] Failed to send to ${to}:`, error.message);
    throw error;
  }
}


export async function sendVerificationEmail(email, code) {
  const appUrl = env.APP_URL || 'http://localhost:3000';

  return sendMail({
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
}

export async function sendVerificationLinkEmail(email, verifyToken) {
  return sendMail({
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
}

export async function sendPasswordResetEmail(email, resetToken) {
  const appUrl = env.APP_URL || 'http://localhost:3000';

  return sendMail({
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
}

export async function sendContributionReceivedEmail(coupleEmail, coupleName, guestName, poolName, amountKzt) {
  return sendMail({
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
}

export async function sendGiftObligationReminderEmail(memberEmail, memberName, weddingTitle, kinshipRank, obligationKzt, contributedKzt) {
  const remaining = obligationKzt - contributedKzt;

  return sendMail({
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
}

export async function sendPoolFundedEmail(coupleEmail, coupleName, poolName, targetKzt, totalFundedKzt) {
  return sendMail({
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
}

export async function sendFragileCarrierNotification({
  coupleEmail,
  coupleName,
  poolName,
  weddingTitle,
  carrierName,
  trackingNumber,
  carrierNotes,
}) {
  return sendMail({
    from: `"Saukele Logistics" <${env.SMTP_FROM || 'noreply@saukele.kz'}>`,
    to: coupleEmail,
    subject: `⚠️ FRAGILE ITEM — Special handling required for "${poolName}"`,
    html: `<!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">
        <style>
          .fragile-badge { background-color: #ff4444; color: white; padding: 12px 24px; font-size: 24px; font-weight: bold; text-align: center; border-radius: 8px; margin: 16px 0; letter-spacing: 4px; }
          .warning-box { border: 3px solid #ff4444; background-color: #fff5f5; padding: 16px; border-radius: 8px; margin: 16px 0; }
          .info-table { border-collapse: collapse; width: 100%; max-width: 500px; margin: 16px 0; }
          .info-table td { padding: 10px; border-bottom: 1px solid #ddd; }
          .info-table td:first-child { font-weight: bold; width: 180px; color: #555; }
        </style>
      </head><body>
        <h1>⚠️ Fragile Item Notification</h1>
        <p>Dear <strong>${carrierName || 'Carrier'}</strong>,</p>
        <p>This shipment contains a <strong>fragile item</strong> that requires special handling.</p>
        <div class="fragile-badge">⚠️ FRAGILE ⚠️</div>
        <div class="warning-box">
          <h3 style="color: #cc0000; margin-top: 0;">🚨 Handling Instructions</h3>
          <ul>
            <li>Do <strong>NOT</strong> stack heavy items on top of this package</li>
            <li>Keep upright — <strong>THIS SIDE UP</strong></li>
            <li>Avoid sudden impacts or drops</li>
            <li>Use extra cushioning material if needed</li>
            <li>Last-mile delivery: handle with extreme care</li>
          </ul>
        </div>
        <h3>Shipment Details</h3>
        <table class="info-table">
          <tr><td>Tracking Number</td><td><strong>${trackingNumber || 'N/A'}</strong></td></tr>
          <tr><td>Gift Pool</td><td><strong>${poolName}</strong></td></tr>
          <tr><td>Wedding</td><td><strong>${weddingTitle}</strong></td></tr>
          <tr><td>Couple</td><td><strong>${coupleName}</strong></td></tr>
          <tr><td>Carrier Notes</td><td style="color: #cc0000; font-weight: bold;">${carrierNotes || '⚠️ FRAGILE — Handle with care'}</td></tr>
        </table>
        <p style="margin-top: 24px;"><em>This is an automated notification from <strong>Saukele Wedding Gift Management</strong>.</em></p>
        <p style="color: #888; font-size: 12px;">Saukele — Wedding Gift Management • ${env.APP_URL || 'http://localhost:3000'}</p>
      </body></html>`,
  });
}

export async function sendLogisticsStartedEmail(coupleEmail, coupleName, poolName, isFragile, trackingNumber) {
  const fragileSection = isFragile ? `
    <div style="border: 2px solid #ff4444; background: #fff5f5; padding: 12px; border-radius: 8px; margin: 16px 0;">
      <p style="color: #cc0000; font-size: 18px; font-weight: bold; margin: 0;">
        ⚠️ This item is marked as <strong>FRAGILE</strong>
      </p>
      <p style="margin: 8px 0 0 0;">A special handling notification has been sent to the carrier.</p>
    </div>
  ` : '';

  return sendMail({
    to: coupleEmail,
    subject: `🚚 Logistics started for "${poolName}" — Saukele`,
    html: `
      <h1>Hello ${coupleName}!</h1>
      <p>Great news! Your gift pool <strong>"${poolName}"</strong> is now in logistics.</p>
      ${fragileSection}
      <table style="border-collapse: collapse; width: 100%; max-width: 400px; margin: 16px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Pool</td><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${poolName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Status</td><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Preparing for shipment</td></tr>
        ${trackingNumber ? `<tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Tracking</td><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${trackingNumber}</td></tr>` : ''}
      </table>
      <p style="margin-top: 16px;"><a href="${env.FRONTEND_URL || env.APP_URL || 'http://localhost:3000'}/pools" style="display:inline-block;padding:12px 24px;background:#2196F3;color:white;text-decoration:none;border-radius:4px;">Track Delivery</a></p>
      <hr><p style="color: #888;">Saukele — Wedding Gift Management</p>
    `,
  });
}

export async function sendRegistryInvitationEmail({
  guestEmail, guestName, coupleName, weddingTitle, invitationLink, registryDescription,
}) {
  return sendMail({
    to: guestEmail,
    subject: `Сізді "${weddingTitle}" тойына шақырамыз! / Приглашение в реестр — Saukele`,
    html: `<!DOCTYPE html>
      <html><head><meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: linear-gradient(135deg, #8B0000, #DAA520); padding: 24px; text-align: center; border-radius: 12px 12px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .header p { color: #FFD700; margin: 8px 0 0 0; font-style: italic; }
          .content { padding: 24px; background: #fafafa; border-radius: 0 0 12px 12px; }
          .btn { display: inline-block; padding: 14px 36px; margin: 16px 0; background: linear-gradient(135deg, #8B0000, #DAA520); color: white !important; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; }
          .ornament { text-align: center; font-size: 24px; color: #DAA520; margin: 16px 0; }
          .footer { text-align: center; color: #888; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px; }
        </style>
      </head><body>
        <div class="header"><h1>🎊 Құттықтаймыз! / Поздравляем!</h1><p>${coupleName} — тойға шақыру / приглашение на свадьбу</p></div>
        <div class="content">
          <div class="ornament">✦ ✦ ✦</div>
          <h2>Құрметті ${guestName}!</h2>
          <p><strong>${coupleName}</strong> сізді <strong>"${weddingTitle}"</strong> тойына арналған сыйлық реестріне қатысуға шақырады.</p>
          <p><em>Уважаемый(ая) ${guestName}! <strong>${coupleName}</strong> приглашает вас принять участие в реестре подарков к свадьбе <strong>"${weddingTitle}"</strong>.</em></p>
          ${registryDescription ? `<p style="background: #fff3e0; padding: 12px; border-radius: 8px; border-left: 4px solid #DAA520;">📝 ${registryDescription}</p>` : ''}
          <div style="text-align: center;"><a href="${invitationLink}" class="btn">🎁 Реестрге қатысу / Участвовать в реестре</a></div>
          <p style="font-size: 14px; color: #666;">Регистрация занимает 1 минуту. После регистрации вы сможете выбрать подарок и внести свой вклад.<br><em>Регистрация займёт 1 минуту. После вы сможете выбрать подарок и внести вклад.</em></p>
        </div>
        <div class="footer"><p>Құрметпен, Saukele — Wedding Gift Management</p><p>С уважением, Saukele — Управление свадебными подарками</p></div>
      </body></html>`,
  });
}

export async function sendPoolProgressEmail({
  coupleEmail, coupleName, poolName, targetKzt, totalFundedKzt, percentage, contributorsCount, remainingDays,
}) {
  const progressBar = Math.min(percentage, 100);
  const barColor = percentage >= 100 ? '#4CAF50' : percentage >= 75 ? '#2196F3' : percentage >= 50 ? '#FF9800' : '#f44336';
  const emoji = percentage >= 100 ? '🎉' : percentage >= 75 ? '💪' : percentage >= 50 ? '👍' : '📈';

  return sendMail({
    to: coupleEmail,
    subject: `${emoji} "${poolName}" — жиналды ${percentage}% / собрано ${percentage}% — Saukele`,
    html: `<!DOCTYPE html>
      <html><head><meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .progress-container { background: #e0e0e0; border-radius: 20px; margin: 16px 0; overflow: hidden; height: 36px; }
          .progress-fill { height: 100%; border-radius: 20px; background: ${barColor}; width: ${progressBar}%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 16px; }
          .stats { display: flex; justify-content: space-around; flex-wrap: wrap; margin: 16px 0; }
          .stat-box { background: #f5f5f5; padding: 16px; border-radius: 12px; min-width: 120px; text-align: center; margin: 4px; }
          .stat-value { font-size: 24px; font-weight: bold; color: ${barColor}; }
          .stat-label { font-size: 12px; color: #888; margin-top: 4px; }
          .btn { display: inline-block; padding: 12px 24px; background: #2196F3; color: white; text-decoration: none; border-radius: 6px; }
        </style>
      </head><body>
        <h1>${emoji} Сәлеметсіз бе, ${coupleName}!</h1>
        <p>Сбор средств для пула <strong>"${poolName}"</strong> продолжается. Вот текущий прогресс:</p>
        <div class="progress-container"><div class="progress-fill">${progressBar >= 20 ? `${percentage}%` : ''}</div>${progressBar < 20 ? `<span style="margin-left: 8px; font-weight: bold;">${percentage}%</span>` : ''}</div>
        <div class="stats">
          <div class="stat-box"><div class="stat-value">${totalFundedKzt.toLocaleString()} ₸</div><div class="stat-label">Собрано / Жиналды</div></div>
          <div class="stat-box"><div class="stat-value">${targetKzt.toLocaleString()} ₸</div><div class="stat-label">Цель / Мақсат</div></div>
          <div class="stat-box"><div class="stat-value">${contributorsCount ?? '—'}</div><div class="stat-label">Гостей / Қонақтар</div></div>
          ${remainingDays !== undefined ? `<div class="stat-box"><div class="stat-value">${remainingDays}</div><div class="stat-label">Дней осталось / Қалған күн</div></div>` : ''}
        </div>
        <p>Қолдау білдіргендердің тізімін көру үшін басқы бетке өтіңіз.<br><em>Перейдите в свой кабинет, чтобы увидеть список поддержавших.</em></p>
        <p><a href="${env.FRONTEND_URL || env.APP_URL || 'http://localhost:3000'}/pools" class="btn">Пулды көру / Посмотреть пул</a></p>
        <hr><p style="color: #888;">Saukele — Wedding Gift Management</p>
      </body></html>`,
  });
}

export async function sendGiftDeliveryConfirmationEmail({
  donorEmail, donorName, coupleName, poolName, deliveryDate, trackingNumber, isFragile,
}) {
  return sendMail({
    to: donorEmail,
    subject: `✅ Сіздің сыйлығыңыз жеткізілді! / Ваш подарок доставлен! — Saukele`,
    html: `<!DOCTYPE html>
      <html><head><meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .success-badge { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 12px; font-size: 24px; margin: 16px 0; }
          .details { background: #f9f9f9; padding: 16px; border-radius: 8px; margin: 16px 0; }
          .btn { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 6px; }
        </style>
      </head><body>
        <div class="success-badge">✅ Жеткізілді! / Доставлено!</div>
        <h1>Құрметті ${donorName}!</h1><h2><em>Уважаемый(ая) ${donorName}!</em></h2>
        <p>Сіздің сыйлығыңыз <strong>"${poolName}"</strong> — <strong>${coupleName}</strong> жұбына сәтті жеткізілді!<br><em>Ваш подарок <strong>"${poolName}"</strong> успешно доставлен паре <strong>${coupleName}</strong>!</em></p>
        <div class="details"><table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; color: #666;">Подарок / Сыйлық</td><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${poolName}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; color: #666;">Жеткізілген күн / Дата доставки</td><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${deliveryDate ? new Date(deliveryDate).toLocaleDateString('ru-RU') : '—'}</td></tr>
          ${trackingNumber ? `<tr><td style="padding: 8px; border-bottom: 1px solid #ddd; color: #666;">Трек номер / Tracking</td><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${trackingNumber}</td></tr>` : ''}
          ${isFragile ? `<tr><td style="padding: 8px; color: #666;">Хрупкий / Сынатын</td><td style="padding: 8px; font-weight: bold; color: #cc0000;">⚠️ Иә / Да</td></tr>` : ''}
        </table></div>
        <p style="font-size: 16px; color: #4CAF50;">🎊 ${coupleName} жұбы сіздің сыйлығыңызға өте риза! / Пара ${coupleName} очень благодарна за ваш подарок!</p>
        <p><a href="${env.FRONTEND_URL || env.APP_URL || 'http://localhost:3000'}/contributions/my" class="btn">Менің сыйлықтарым / Мои подарки</a></p>
        <hr><p style="color: #888;">Saukele — Wedding Gift Management</p>
      </body></html>`,
  });
}

export async function sendGentlePaymentReminderEmail({
  memberEmail, memberName, coupleName, weddingTitle, kinshipRank, obligationKzt, contributedKzt, remainingKzt,
}) {
  return sendMail({
    to: memberEmail,
    subject: `💐 Еске салу / Напоминание о "${weddingTitle}" — Saukele`,
    html: `<!DOCTYPE html>
      <html><head><meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .gentle-header { background: linear-gradient(135deg, #FFE0B2, #FFF3E0); padding: 24px; text-align: center; border-radius: 12px; }
          .gentle-header h1 { color: #E65100; margin: 0; font-size: 24px; }
          .gentle-header p { color: #BF360C; font-style: italic; }
          .content { padding: 24px; }
          .btn { display: inline-block; padding: 12px 24px; background: #FF9800; color: white; text-decoration: none; border-radius: 6px; }
          .note { background: #FFF8E1; padding: 16px; border-left: 4px solid #FFB300; border-radius: 4px; margin: 16px 0; font-size: 14px; }
          .footer { text-align: center; color: #888; font-size: 12px; margin-top: 24px; }
        </style>
      </head><body>
        <div class="gentle-header"><h1>💐 Сәлеметсіз бе, ${memberName}!</h1><p><em>Уважаемый(ая) ${memberName}!</em></p></div>
        <div class="content">
          <p>Біз сізге <strong>${coupleName}</strong> жұбының <strong>"${weddingTitle}"</strong> тойына қатысты еске салғымыз келеді.<br><em>Мы хотели бы напомнить вам о предстоящей свадьбе <strong>"${weddingTitle}"</strong> пары <strong>${coupleName}</strong>.</em></p>
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;"><table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Туыстық дәреже / Степень родства</td><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${kinshipRank}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Күтілетін сый / Ожидаемый вклад</td><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${obligationKzt.toLocaleString()} ₸</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Аударылды / Внесено</td><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; color: #4CAF50;">${contributedKzt.toLocaleString()} ₸</td></tr>
            <tr><td style="padding: 8px; color: #E65100; font-weight: bold;">Қалды / Осталось</td><td style="padding: 8px; font-weight: bold; color: #E65100;">${remainingKzt.toLocaleString()} ₸</td></tr>
          </table></div>
          <div class="note"><strong>💡 Ізгі тілек:</strong> Сіз өз ыңғайыңызға қарай кез келген уақытта үлес қоса аласыз. Біз сіздің қолдауыңызды бағалаймыз!<br><em>Вы можете внести вклад в любое удобное для вас время. Мы ценим вашу поддержку!</em></div>
          <div style="text-align: center; margin: 24px 0;"><a href="${env.FRONTEND_URL || env.APP_URL || 'http://localhost:3000'}/family/obligations" class="btn">🎁 Үлес қосу / Внести вклад</a></div>
          <p style="font-size: 14px; color: #888;">Егер сіз қазірдің өзінде үлес қосқан болсаңыз, бұл хатты елемеуіңізге болады.<br><em>Если вы уже внесли вклад, просто проигнорируйте это письмо.</em></p>
        </div>
        <div class="footer"><p>Жылы лебізбен, Saukele / С теплотой, Saukele — Wedding Gift Management</p></div>
      </body></html>`,
  });
}

export async function sendDeliveryStatusUpdateEmail(coupleEmail, coupleName, poolName, deliveryStatus, trackingNumber, isFragile) {
  const statusLabels = {
    PREPARING: 'Preparing for shipment',
    HANDED_TO_CARRIER: 'Handed to carrier',
    IN_TRANSIT: 'In transit',
    OUT_FOR_DELIVERY: 'Out for delivery',
    DELIVERED: 'Delivered',
    FAILED: 'Delivery failed',
  };

  const fragileBadge = isFragile ? ' ⚠️ FRAGILE' : '';
  const statusColor = deliveryStatus === 'DELIVERED' ? '#4CAF50'
    : deliveryStatus === 'FAILED' ? '#f44336'
    : '#2196F3';

  return sendMail({
    to: coupleEmail,
    subject: `📦 Delivery update: ${statusLabels[deliveryStatus] || deliveryStatus} for "${poolName}"${fragileBadge} — Saukele`,
    html: `
      <h1>Hello ${coupleName}!</h1>
      <p>Your delivery for <strong>"${poolName}"</strong> has been updated.</p>

      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; background: ${statusColor}; color: white; padding: 16px 32px; border-radius: 8px; font-size: 20px; font-weight: bold;">
          ${statusLabels[deliveryStatus] || deliveryStatus}
          ${isFragile ? ' ⚠️' : ''}
        </div>
      </div>

      ${isFragile ? `
        <div style="border: 2px solid #ff4444; background: #fff5f5; padding: 12px; border-radius: 8px; margin: 16px 0;">
          <p style="color: #cc0000; font-weight: bold; margin: 0;">
            ⚠️ This is a fragile item — please ensure careful handling.
          </p>
        </div>
      ` : ''}

      <table style="border-collapse: collapse; width: 100%; max-width: 400px; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">Pool</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${poolName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">Status</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${statusLabels[deliveryStatus] || deliveryStatus}</td>
        </tr>
        ${trackingNumber ? `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">Tracking</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${trackingNumber}</td>
        </tr>
        ` : ''}
        ${isFragile ? `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">Fragile</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; color: #cc0000;">⚠️ Yes — handle with care</td>
        </tr>
        ` : ''}
      </table>

      <p style="margin-top: 16px;">
        <a href="${env.FRONTEND_URL || env.APP_URL || 'http://localhost:3000'}/pools"
           style="display:inline-block;padding:12px 24px;background:#2196F3;color:white;text-decoration:none;border-radius:4px;">
          Track Delivery
        </a>
      </p>
      <hr>
      <p style="color: #888;">Saukele — Wedding Gift Management</p>
    `,
  });
}

export async function sendRegistryConfirmationEmail({
  ownerEmail, ownerName, weddingTitle, weddingDate, registryLink,
}) {
  return sendMail({
    to: ownerEmail,
    subject: `🎊 Ваш свадебный реестр "${weddingTitle}" создан! / Реестріңіз құрылды! — Saukele`,
    html: `<!DOCTYPE html>
      <html><head><meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: linear-gradient(135deg, #8B0000, #DAA520); padding: 24px; text-align: center; border-radius: 12px 12px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .header p { color: #FFD700; margin: 8px 0 0 0; font-style: italic; }
          .content { padding: 24px; background: #fafafa; border-radius: 0 0 12px 12px; }
          .btn { display: inline-block; padding: 14px 36px; margin: 16px 0; background: linear-gradient(135deg, #8B0000, #DAA520); color: white !important; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; }
          .ornament { text-align: center; font-size: 24px; color: #DAA520; margin: 16px 0; }
          .details { background: #fff; padding: 16px; border-radius: 8px; border: 1px solid #e0e0e0; margin: 16px 0; }
          .details td { padding: 10px; border-bottom: 1px solid #f0f0f0; }
          .details td:first-child { font-weight: bold; color: #666; width: 160px; }
          .gift-list { margin: 16px 0; }
          .gift-item { display: inline-block; background: #fff3e0; padding: 8px 16px; margin: 4px; border-radius: 20px; font-size: 14px; border: 1px solid #FFE0B2; }
          .footer { text-align: center; color: #888; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px; }
        </style>
      </head><body>
        <div class="header">
          <h1>🎊 Құттықтаймыз! / Поздравляем!</h1>
          <p>Ваш свадебный реестр создан / Той реестріңіз құрылды</p>
        </div>
        <div class="content">
          <div class="ornament">✦ ✦ ✦</div>
          <h2>Құрметті ${ownerName}!</h2>
          <p><em>Уважаемый(ая) ${ownerName}!</em></p>
          <p>Ваш свадебный реестр <strong>"${weddingTitle}"</strong> успешно создан с традиционными подарками!</p>
          <p><em>Сіздің <strong>"${weddingTitle}"</strong> реестріңіз дәстүрлі сыйлықтармен құрылды!</em></p>
          <div class="details">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td>Реестр / Реестр</td><td><strong>${weddingTitle}</strong></td></tr>
              <tr><td>Дата / Күні</td><td><strong>${new Date(weddingDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></td></tr>
              <tr><td>Статус / Күйі</td><td><strong style="color: #4CAF50;">✅ Активен</strong></td></tr>
            </table>
          </div>
          <p><strong>🎁 Добавленные подарки:</strong></p>
          <div class="gift-list">
            <span class="gift-item">💍 Саукеле</span>
            <span class="gift-item">🥛 Сүт ақы</span>
            <span class="gift-item">💰 Қаржы</span>
          </div>
          <p>Приглашайте гостей и начинайте сбор!</p>
          <p><em>Қонақтарды шақырып, жинауды бастаңыз!</em></p>
          <div style="text-align: center;">
            <a href="${registryLink}" class="btn">🎁 Реестрді көру</a>
          </div>
        </div>
        <div class="footer">
          <p>Saukele — Wedding Gift Management</p>
        </div>
      </body></html>`,
  });
}