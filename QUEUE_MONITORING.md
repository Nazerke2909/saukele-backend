# Queue Observability & Cron Schedule

## Bull Board Dashboard

A visual UI for monitoring all queues in real-time.

**URL:** `http://localhost:3000/admin/queues`

**Features:**
- View all queues (email, webhooks, cron)
- Job states: waiting, active, completed, failed, delayed
- Job details (data, attempts, error stacktrace)
- Retry failed jobs
- Remove jobs from queue

---

## REST API Endpoints

### GET /admin/queue-stats
Summary of all queues.

**Response:**
```json
[
  {
    "name": "email",
    "counts": { "waiting": 0, "active": 0, "completed": 142, "failed": 3, "delayed": 0 }
  },
  {
    "name": "webhooks",
    "counts": { "waiting": 0, "active": 0, "completed": 27, "failed": 2, "delayed": 0 }
  },
  {
    "name": "cron",
    "counts": { "waiting": 0, "active": 0, "completed": 89, "failed": 0, "delayed": 4 }
  }
]
```

### GET /admin/queue-stats/:queueName
Detailed stats for a specific queue + last 50 jobs.

**Parameters:** `queueName` — `email`, `webhooks` or `cron`

**Response:**
```json
{
  "name": "email",
  "counts": { "waiting": 0, "active": 0, "completed": 142, "failed": 3, "delayed": 0 },
  "recentJobs": [
    {
      "id": 1,
      "type": "verification",
      "attemptsMade": 1,
      "maxAttempts": 3,
      "status": "completed",
      "timestamp": 1719000000000,
      "finishedOn": 1719000001000,
      "failedReason": null,
      "data": { "type": "verification", "data": { "email": "user@example.com" } }
    }
  ]
}
```

### GET /admin/queue-stats/:queueName/jobs/:jobId
Full details of a specific job (data, opts, stacktrace, return value).

### POST /admin/queue-stats/:queueName/jobs/:jobId/retry
Retry a failed job.

### DELETE /admin/queue-stats/:queueName/jobs/:jobId
Remove a job from the queue.

---

## Job States

| State | Description |
|---|---|
| `waiting` | Job is queued and waiting for a worker |
| `active` | Job is currently being processed |
| `completed` | Job finished successfully |
| `failed` | Job failed after all retries exhausted |
| `delayed` | Job is delayed (waiting for retry backoff) |

---

## Retry Configuration

| Queue | Max Attempts | Backoff Strategy | Initial Delay |
|---|---|---|---|
| **email** | 3 | exponential | 60s → 2min → 4min |
| **webhooks** | 5 | exponential | 30s → 1min → 2min → 4min → 8min |
| **cron** | 1 (no retry) | — | — |

---

## Audit Trail in Database

All queue job state transitions are logged into the `audit_logs` table:

| Field | Value |
|---|---|
| `action` | `QUEUE_COMPLETED` or `QUEUE_FAILED` |
| `entity_type` | `Queue:email`, `Queue:webhooks`, `Queue:cron` |
| `entity_id` | Job ID |
| `new_value` | JSON object with job type, attempts count, error message |

---

## Cron Schedule — Periodic Jobs

| Job Name | Cron Expression | Description |
|---|---|---|
| **deadStockDecay** | `0 3 * * *` (daily at 03:00) | Scans pools: FUNDING with no activity >30d → PENDING; PURCHASED >90d → alert |
| **rateUpdate** | `0 * * * *` (every hour) | Updates exchange rates USD→KZT, EUR→KZT with simulated ±5 variation |
| **dailyObligationReminders** | `0 9 * * *` (daily at 09:00) | Sends gift obligation reminders to all family members with outstanding obligations |
| **abandonedCartRecovery** | `0 * * * *` (every hour) | Finds PENDING contributions older than 24h and sends recovery reminders |

### Job IDs (for deduplication)

Each repeating job has a fixed `jobId` to prevent duplicates on worker restart:

- `dead-stock-decay-daily`
- `rate-update-hourly`
- `daily-obligation-reminders`
- `abandoned-cart-recovery-hourly`

---

## Startup Logging

When the worker starts, it logs:

```
[WORKER] All queue workers started
[WORKER]   emailQueue — email notifications
[WORKER]   webhookQueue — webhook retries (max 5 attempts)
[WORKER]   cronQueue — periodic tasks (dead stock, rates, reminders, cart recovery)
[CRON] All periodic jobs registered
```
