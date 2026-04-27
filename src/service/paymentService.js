const idempotencyStore = new Map();

export async function processPayment(amountKzt, idempotencyKey) {
  if (idempotencyStore.has(idempotencyKey)) {
    return idempotencyStore.get(idempotencyKey);
  }

  const paymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const result = {
    success: true,
    paymentIntentId,
    amountKzt,
    status: 'COMPLETED',
  };

  idempotencyStore.set(idempotencyKey, result);

  return result;
}

export default processPayment;
