import * as logisticsService from '../service/logisticsService.js';


export const createTracking = async (req, res) => {
  const poolId = Number(req.params.id);
  const tracking = await logisticsService.createLogisticsTracking(poolId, req.user.id, req.ip);
  res.status(201).json(tracking);
};

export const assignCarrier = async (req, res) => {
  const poolId = Number(req.params.id);
  const { carrierName, trackingNumber, estimatedDelivery } = req.body;

  if (!carrierName || !trackingNumber) {
    return res.status(400).json({ error: 'carrierName and trackingNumber are required' });
  }

  const tracking = await logisticsService.assignCarrier(
    poolId,
    { carrierName, trackingNumber, estimatedDelivery },
    req.user.id,
    req.ip
  );

  res.json(tracking);
};

export const updateStatus = async (req, res) => {
  const poolId = Number(req.params.id);
  const { deliveryStatus, carrierNotes } = req.body;

  if (!deliveryStatus) {
    return res.status(400).json({ error: 'deliveryStatus is required' });
  }

  const validStatuses = ['PREPARING', 'HANDED_TO_CARRIER', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'];
  if (!validStatuses.includes(deliveryStatus)) {
    return res.status(400).json({
      error: `Invalid deliveryStatus. Valid values: ${validStatuses.join(', ')}`,
    });
  }

  const tracking = await logisticsService.updateDeliveryStatus(
    poolId,
    deliveryStatus,
    { carrierNotes },
    req.user.id,
    req.ip
  );

  res.json(tracking);
};

export const getTracking = async (req, res) => {
  const poolId = Number(req.params.id);
  const tracking = await logisticsService.getLogisticsTracking(poolId);
  res.json(tracking);
};