import { emailQueue, webhookQueue, cronQueue } from './queue.js';
import { getDelayUntilAllowed } from '../utils/culturalTiming.js';

export function queueVerificationEmail(email, code) {
  console.log(`[PRODUCER] Adding verification email to queue for ${email}`);
  return emailQueue.add({
    type: 'verification',
    data: { email, code },
  });
}

export function queueVerificationLinkEmail(email, token) {
  console.log(`[PRODUCER] Adding verification link email to queue for ${email}`);
  return emailQueue.add({
    type: 'verificationLink',
    data: { email, token },
  });
}

export function queuePasswordResetEmail(email, token) {
  console.log(`[PRODUCER] Adding password reset email to queue for ${email}`);
  return emailQueue.add({
    type: 'passwordReset',
    data: { email, token },
  });
}

export function queueContributionNotification(coupleEmail, coupleName, guestName, poolName, amountKzt) {
  return emailQueue.add({
    type: 'contributionReceived',
    data: { coupleEmail, coupleName, guestName, poolName, amountKzt },
  });
}

export function queuePoolFundedNotification(coupleEmail, coupleName, poolName, targetKzt, totalFundedKzt) {
  return emailQueue.add({
    type: 'poolFunded',
    data: { coupleEmail, coupleName, poolName, targetKzt, totalFundedKzt },
  });
}

export function queueObligationReminder(memberEmail, memberName, weddingTitle, kinshipRank, obligationKzt, contributedKzt) {
  return emailQueue.add({
    type: 'obligationReminder',
    data: { memberEmail, memberName, weddingTitle, kinshipRank, obligationKzt, contributedKzt },
  });
}

export function queueWebhookRetry(url, payload, eventType) {
  return webhookQueue.add({
    url,
    payload,
    eventType,
  });
}

export function queueDeadStockDecay(poolId) {
  return cronQueue.add(
    { type: 'deadStockDecay', data: { poolId } },
    { delay: 7 * 24 * 60 * 60 * 1000 } 
  );
}

export function queueRateUpdate() {
  return cronQueue.add(
    { type: 'rateUpdate', data: {} },
    { repeat: { every: 60 * 60 * 1000 } } 
  );
}

export function queueDailyObligationReminders() {
  return cronQueue.add(
    { type: 'dailyObligationReminders', data: {} },
    { repeat: { cron: '0 9 * * *' } }
  );
}

export function queueAbandonedCartRecovery() {
  return cronQueue.add(
    { type: 'abandonedCartRecovery', data: {} },
    { repeat: { every: 60 * 60 * 1000 } }
  );
}

export function queueRegistryInvitation({ guestEmail, guestName, coupleName, weddingTitle, invitationLink, registryDescription }) {
  const delay = getDelayUntilAllowed();
  return emailQueue.add(
    {
      type: 'registryInvitation',
      data: { guestEmail, guestName, coupleName, weddingTitle, invitationLink, registryDescription },
    },
    { delay }
  );
}

export function queuePoolProgressNotification({ coupleEmail, coupleName, poolName, targetKzt, totalFundedKzt, percentage, contributorsCount, remainingDays }) {
  const delay = getDelayUntilAllowed();
  return emailQueue.add(
    {
      type: 'poolProgress',
      data: { coupleEmail, coupleName, poolName, targetKzt, totalFundedKzt, percentage, contributorsCount, remainingDays },
    },
    { delay }
  );
}

export function queueGiftDeliveryConfirmation({ donorEmail, donorName, coupleName, poolName, deliveryDate, trackingNumber, isFragile }) {
  const delay = getDelayUntilAllowed();
  return emailQueue.add(
    {
      type: 'giftDeliveryConfirmation',
      data: { donorEmail, donorName, coupleName, poolName, deliveryDate, trackingNumber, isFragile },
    },
    { delay }
  );
}

export function queueGentlePaymentReminder({ memberEmail, memberName, coupleName, weddingTitle, kinshipRank, obligationKzt, contributedKzt, remainingKzt }) {
  const delay = getDelayUntilAllowed();
  return emailQueue.add(
    {
      type: 'gentlePaymentReminder',
      data: { memberEmail, memberName, coupleName, weddingTitle, kinshipRank, obligationKzt, contributedKzt, remainingKzt },
    },
    { delay }
  );
}