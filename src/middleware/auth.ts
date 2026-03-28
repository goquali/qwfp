import { FastifyRequest, FastifyReply } from "fastify";
import { AuthorizationError } from "../shared/errors.js";
import type { UserRole } from "../shared/types.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
    };
  }
}

/**
 * Middleware that extracts user from X-User-Id header (for dev/MVP).
 * In production, replace with JWT/OAuth validation.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = request.headers["x-user-id"] as string;
  if (!userId) {
    reply.code(401).send({ error: "Missing X-User-Id header" });
    return;
  }

  // In a real app, look up the user from DB. For MVP, we also accept
  // role passed via header for easy testing.
  const role = (request.headers["x-user-role"] as UserRole) || "business_owner";
  request.currentUser = {
    id: userId,
    email: request.headers["x-user-email"] as string || "unknown@example.com",
    name: request.headers["x-user-name"] as string || "Unknown User",
    role,
  };
}

/**
 * Factory for role-based access control middleware.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.currentUser) {
      reply.code(401).send({ error: "Not authenticated" });
      return;
    }

    if (
      request.currentUser.role !== "admin" &&
      !allowedRoles.includes(request.currentUser.role)
    ) {
      throw new AuthorizationError(
        `Role '${request.currentUser.role}' is not authorized. Required: ${allowedRoles.join(", ")}`,
      );
    }
  };
}
