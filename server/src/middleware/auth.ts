import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { User } from "../models/User.js";
import { Plant } from "../models/Plant.js";
import { Company } from "../models/Company.js";

/**
 * Roles allowed to read and change HR records (attendance, holidays, salary).
 * Mirrors `canManage` in src/hooks/usePlantScope.ts so the two cannot drift.
 */
export const HR_ROLES = ["hr", "plant_manager", "oem_admin", "super_admin"] as const;

/** Roles that may see every plant regardless of their own plant assignment. */
const GLOBAL_SCOPE_ROLES = ["super_admin"] as const;

const TOKEN_TTL_SECONDS = 60 * 60 * 12;

const DEV_SECRET = "bytematrix-dev-secret-do-not-use-in-production";

const secret = (): string => {
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set to at least 16 characters in production");
  }
  return DEV_SECRET;
};

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const unb64url = (input: string): Buffer => Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export interface TokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

export function signToken(userId: string): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    } satisfies TokenPayload)
  );
  const signature = crypto.createHmac("sha256", secret()).update(`${header}.${payload}`).digest();
  return `${header}.${payload}.${b64url(signature)}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;

  const expected = crypto.createHmac("sha256", secret()).update(`${header}.${payload}`).digest();
  const given = unb64url(signature);
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  try {
    const parsed = JSON.parse(unb64url(payload).toString("utf8")) as TokenPayload;
    if (typeof parsed.sub !== "string" || typeof parsed.exp !== "number") return null;
    if (parsed.exp * 1000 <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** The request user, guaranteed fresh from the database. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  plant: string;
  status: "active" | "inactive";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Plant ids this request may touch. `null` means every plant. */
      plantScope?: string[] | null;
    }
  }
}

/** Rejects the request unless it carries a valid, unexpired token for an active user. */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Session expired, sign in again" });

  const user = await User.findById(payload.sub).lean();
  if (!user) return res.status(401).json({ error: "Account no longer exists" });
  if (user.status !== "active") return res.status(403).json({ error: "Account is inactive" });

  req.user = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    company: user.company,
    plant: user.plant,
    status: user.status,
  };
  next();
}

/** Restricts a route to the listed roles. Must run after `authenticate`. */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Your role cannot perform this action" });
    }
    next();
  };
}

export const requireHr = requireRole(...HR_ROLES);

/**
 * Resolves the plants a user is allowed to touch and caches them on the
 * request. Super admins get `null`, meaning unrestricted.
 */
export async function resolvePlantScope(user: AuthUser): Promise<string[] | null> {
  if ((GLOBAL_SCOPE_ROLES as readonly string[]).includes(user.role)) return null;

  if (user.role === "oem_admin") {
    const company = await Company.findOne({ name: user.company }).lean();
    if (!company) return [];
    const plants = await Plant.find({ companyId: company._id }).lean();
    return plants.map((p) => String(p._id));
  }

  const plants = await Plant.find({ name: user.plant }).lean();
  return plants.map((p) => String(p._id));
}

/** Populates `req.plantScope` once per request. */
export async function loadPlantScope(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return res_unauthorized(_res);
  if (req.plantScope === undefined) {
    req.plantScope = await resolvePlantScope(req.user);
  }
  next();
}

function res_unauthorized(res: Response) {
  return res.status(401).json({ error: "Authentication required" });
}

export function isInScope(req: Request, plantId: string | undefined | null): boolean {
  if (!plantId) return false;
  if (req.plantScope === null) return true;
  return (req.plantScope || []).includes(plantId);
}

/**
 * Rejects a plant id outside the caller's scope. Applied to HR routes so a
 * crafted request cannot read or pay another plant's operators.
 */
export function requirePlantInScope(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });

  const requested =
    (req.query.plantId as string | undefined) ||
    (req.body?.plantId as string | undefined) ||
    (req.params.plantId as string | undefined);

  if (!requested) return res.status(400).json({ error: "plantId is required" });
  if (!isInScope(req, requested)) {
    return res.status(403).json({ error: "You do not have access to that plant" });
  }
  next();
}

/**
 * Restricts list queries to the caller's plants when no plantId is given, so an
 * unscoped `GET` cannot dump every plant's records.
 */
export function scopeFilter(req: Request): Record<string, unknown> {
  if (req.plantScope === null) return {};
  return { plantId: { $in: req.plantScope || [] } };
}
