import rateLimit from 'express-rate-limit';

class MemoryStore {
  constructor() {
    this.hits = new Map();
  }
  init(options) { this.windowMs = options.windowMs; }
  async get(key) {
    const now = Date.now();
    const record = this.hits.get(key);
    if (!record) return { totalHits: 0, resetTime: new Date(now + this.windowMs) };
    const elapsed = now - record.startTime;
    if (elapsed > this.windowMs) {
      this.hits.delete(key);
      return { totalHits: 0, resetTime: new Date(now + this.windowMs) };
    }
    return { totalHits: record.count, resetTime: new Date(record.startTime + this.windowMs) };
  }
  async increment(key) {
    const now = Date.now();
    let record = this.hits.get(key);
    if (!record || (now - record.startTime) > this.windowMs) {
      record = { count: 1, startTime: now };
    } else {
      record.count++;
    }
    this.hits.set(key, record);
    return { totalHits: record.count, resetTime: new Date(record.startTime + this.windowMs) };
  }
  async decrement(key) {
    const record = this.hits.get(key);
    if (record) {
      record.count = Math.max(0, record.count - 1);
    }
  }
  async resetKey(key) { this.hits.delete(key); }
}

export const loginLimiter = rateLimit({
  store: new MemoryStore(),
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, try again later' },
});

export const registerLimiter = rateLimit({
  store: new MemoryStore(),
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts, try again later' },
});

export const generalLimiter = rateLimit({
  store: new MemoryStore(),
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

export default loginLimiter;
