import { redisConnection } from '../config/redis';
import { config } from '../config/env';

export interface RateLimitResult {
  allowed: boolean;
  reason?: 'DELAY' | 'RATE_LIMIT';
  rescheduleDelayMs?: number;
}

export class RateLimitService {
  /**
   * Atomic Lua script to check minimum send delay and hourly rate limit.
   * Returns a 2-element array: [status_code, value]
   * status_code:
   *   0 = Allowed (value = new count)
   *   1 = Delayed (value = next allowed timestamp)
   *   2 = Rate limited (value = -1)
   */
  private static luaScript = `
    local next_allowed_key = KEYS[1]
    local rate_limit_key = KEYS[2]

    local now = tonumber(ARGV[1])
    local min_delay = tonumber(ARGV[2])
    local max_limit = tonumber(ARGV[3])
    local ttl = tonumber(ARGV[4])

    -- 1. Check minimum delay constraint (system-wide next allowed send time)
    local next_allowed = redis.call('GET', next_allowed_key)
    if not next_allowed then
        next_allowed = 0
    else
        next_allowed = tonumber(next_allowed)
    end

    if now < next_allowed then
        return { 1, next_allowed }
    end

    -- 2. Check hourly limit constraint (per-sender window count)
    local current = redis.call('GET', rate_limit_key)
    if current then
        current = tonumber(current)
    else
        current = 0
    end

    if current >= max_limit then
        return { 2, -1 }
    end

    -- 3. Both are allowed! Atomically update next allowed time and increment hour counter
    local new_allowed = now + min_delay
    redis.call('SET', next_allowed_key, new_allowed)

    local new_count = redis.call('INCR', rate_limit_key)
    if new_count == 1 then
        redis.call('EXPIRE', rate_limit_key, ttl)
    end

    return { 0, new_count }
  `;

  /**
   * Helper to retrieve active Redis keys
   */
  private static getKeys(sender: string) {
    const hourWindow = new Date().toISOString().substring(0, 13); // format: YYYY-MM-DDTHH
    return {
      nextAllowedKey: `email_scheduler:next_allowed_send_time`,
      rateLimitKey: `email_rate_limit:${sender.toLowerCase()}:${hourWindow}`,
    };
  }

  /**
   * Atomically check and reserve slots for sending an email
   */
  static async checkAndReserve(sender: string): Promise<RateLimitResult> {
    const { nextAllowedKey, rateLimitKey } = this.getKeys(sender);
    const now = Date.now();
    const minDelay = config.minDelayBetweenEmailsMs;
    const maxLimit = config.maxEmailsPerHour;
    const ttl = 7200; // 2 hours TTL to automatically clean up old keys

    // Execute atomic Lua evaluation in Upstash Redis
    const result = await redisConnection.eval(
      this.luaScript,
      2,
      nextAllowedKey,
      rateLimitKey,
      now,
      minDelay,
      maxLimit,
      ttl
    ) as [number, number];

    const [status, val] = result;

    if (status === 0) {
      return { allowed: true };
    } else if (status === 1) {
      const nextAllowedTime = val;
      const rescheduleDelayMs = Math.max(0, nextAllowedTime - now);
      return {
        allowed: false,
        reason: 'DELAY',
        rescheduleDelayMs,
      };
    } else {
      // Calculate delay until the start of the next hour window
      const nextHour = new Date(now);
      nextHour.setUTCMinutes(0, 0, 0);
      nextHour.setUTCHours(nextHour.getUTCHours() + 1);
      const rescheduleDelayMs = nextHour.getTime() - now;

      return {
        allowed: false,
        reason: 'RATE_LIMIT',
        rescheduleDelayMs,
      };
    }
  }

  /**
   * Revert a reserved rate-limit slot in case of a direct SMTP exception before sending
   */
  static async releaseSlot(sender: string): Promise<void> {
    const { rateLimitKey } = this.getKeys(sender);
    const exists = await redisConnection.exists(rateLimitKey);
    if (exists) {
      await redisConnection.decr(rateLimitKey);
    }
  }

  /**
   * Concurrency-safe deduplication gate for Slack alerts.
   * Returns true if this is the first rate limit event for this sender in the current hour window,
   * reserving the slot for 2 hours.
   */
  static async acquireAlertLock(sender: string): Promise<boolean> {
    const hourWindow = new Date().toISOString().substring(0, 13);
    const key = `slack_alert_sent:${sender.toLowerCase()}:${hourWindow}`;
    const result = await redisConnection.set(key, '1', 'EX', 7200, 'NX');
    return result === 'OK';
  }
}
