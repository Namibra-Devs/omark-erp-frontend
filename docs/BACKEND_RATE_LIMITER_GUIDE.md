# Omark ERP — Production Backend Rate Limiter Implementation & Guide

This document contains the drop-in rate limiting middleware and configuration for the Omark ERP Backend API (`api.erp.omarkrealestate.com`).

---

## 1. Root Problem in Previous Configuration

Previous settings returned by `api.erp.omarkrealestate.com`:
- `ratelimit-limit: 600; w=900` (600 requests per 15 min = **40 req/min**)
- `ratelimit-limit: 20; w=900` for `/auth/login`
- **Keyed exclusively by `req.ip`**: In an office/branch setting where 5–10 staff share one public IP address (NAT) or behind an Nginx reverse proxy without `trust proxy`, **the entire office exhausts 600 requests within 2 minutes**, locking all users out with `RATE_LIMITED`.

---

## 2. Drop-In Express Rate Limiter Middleware (`rateLimiter.ts`)

Save this file in your backend project (e.g., `src/middleware/rateLimiter.ts` or `src/common/guards/rateLimiter.ts`):

```typescript
import rateLimit, { Options } from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Standard error response envelope matching Omark ERP frontend error format
 */
const rateLimitHandler = (req: Request, res: Response) => {
  const retryAfter = res.getHeader('Retry-After') || 15;
  res.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later.',
      details: [
        {
          field: 'rateLimit',
          message: `Request limit reached. Please wait ${retryAfter} seconds before retrying.`,
        },
      ],
    },
  });
};

/**
 * Smart Key Generator:
 * - If user is authenticated (JWT decoded user or token exists), rate limit by User ID.
 *   This ensures 20 staff members at the same branch sharing a single public IP never lock each other out!
 * - If unauthenticated (login, public portal, pre-auth), rate limit by real client IP.
 */
const dynamicKeyGenerator = (req: Request): string => {
  // Check authenticated user attached by auth middleware
  const user = (req as any).user;
  if (user && (user.id || user.userId || user.sub)) {
    return `user:${user.id || user.userId || user.sub}`;
  }

  // Check Bearer token in header if auth middleware runs after rate limiter
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token && token.length > 20) {
      // Use token suffix as key
      return `token:${token.slice(-32)}`;
    }
  }

  // Fallback to real IP (requires app.set('trust proxy', 1))
  return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
};

/**
 * 1. General API Limiter (GET / READ requests)
 * High throughput: 5,000 requests per 15 minutes per user/IP
 * Perfect for multi-widget ERP dashboards, search filters, and table pagination.
 */
export const apiReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000,
  standardHeaders: 'draft-7', // Returns standard RateLimit-* headers
  legacyHeaders: false,
  keyGenerator: dynamicKeyGenerator,
  handler: rateLimitHandler,
  skip: (req) => req.method === 'OPTIONS', // Skip CORS preflight
});

/**
 * 2. Mutation Limiter (POST, PUT, PATCH, DELETE)
 * 1,000 write requests per 15 minutes per user
 * Gives ample headroom for data entry while stopping infinite mutation loops & abuse.
 */
export const apiWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: dynamicKeyGenerator,
  handler: rateLimitHandler,
  skip: (req) => req.method === 'OPTIONS' || req.method === 'GET' || req.method === 'HEAD',
});

/**
 * 3. Auth & Login Limiter (/api/v1/auth/login, /portal/auth/login)
 * 60 attempts per 15 minutes per IP
 * Allows all employees at an office to log in during morning peak while preventing brute-force password spraying.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `auth:${req.ip || 'unknown'}`,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true, // DO NOT count successful logins against the quota!
});

/**
 * 4. Heavy / Bulk Operations Limiter (file uploads, exports, payroll batch)
 * 120 requests per 15 minutes per user
 */
export const heavyOpsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: dynamicKeyGenerator,
  handler: rateLimitHandler,
});
```

---

## 3. Server Integration (`server.ts` or `app.ts`)

```typescript
import express from 'express';
import {
  apiReadLimiter,
  apiWriteLimiter,
  authLimiter,
  heavyOpsLimiter,
} from './middleware/rateLimiter';

const app = express();

// ============================================================
// CRITICAL: Trust Reverse Proxy (Nginx / Cloudflare / Load Balancer)
// Without this, req.ip will be 127.0.0.1 and ALL users share one quota!
// ============================================================
app.set('trust proxy', 1);

// Standard Middlewares
app.use(express.json());

// 1. Apply strict limiter to Authentication routes
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/portal/auth/login', authLimiter);
app.use('/api/v1/portal/auth/activate', authLimiter);

// 2. Apply heavy operations limiter to uploads / exports
app.use('/api/v1/uploads', heavyOpsLimiter);
app.use('/api/v1/notifications/test', heavyOpsLimiter);

// 3. Apply general read/write limiters to API routes
// (Read limiter allows 5,000 req/15min, write limiter allows 1,000 req/15min)
app.use('/api/v1', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return apiWriteLimiter(req, res, next);
  }
  return apiReadLimiter(req, res, next);
});
```

---

## 4. Redis Store (Optional but Recommended for Multi-Instance Backends)

If running multiple server processes or PM2 cluster instances on Contabo / Hetzner / AWS:
```bash
npm install rate-limit-redis redis
```

```typescript
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.connect().catch(console.error);

export const apiReadLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  windowMs: 15 * 60 * 1000,
  max: 5000,
  keyGenerator: dynamicKeyGenerator,
  handler: rateLimitHandler,
});
```
