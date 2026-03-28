import { FastifyRequest, FastifyReply } from "fastify";

/**
 * Simple audit logging middleware. Logs all mutating requests.
 * In production, this would write to an audit_logs table.
 */
export async function auditLog(request: FastifyRequest, reply: FastifyReply) {
  const method = request.method;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const userId = request.currentUser?.id || "anonymous";
    const role = request.currentUser?.role || "unknown";
    console.log(
      `[AUDIT] ${new Date().toISOString()} | ${method} ${request.url} | user=${userId} role=${role}`,
    );
  }
}
