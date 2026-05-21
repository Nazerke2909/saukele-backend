const idempotencyStore = new Map();

export async function processPayment({ amount, currency, idempotencyKey }) {
  if (idempotencyStore.has(idempotencyKey)) {
    return idempotencyStore.get(idempotencyKey);
  }

  const paymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const result = {
    success: true,
    paymentIntentId,
    amountKzt: amount,
    status: 'COMPLETED',
  };

  idempotencyStore.set(idempotencyKey, result);

  return result;
}

export default processPayment;