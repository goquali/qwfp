export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string | number) {
    super(404, `${entity} with id ${id} not found`, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public details?: Record<string, string>,
  ) {
    super(400, message, "VALIDATION_ERROR");
  }
}

export class GuardrailError extends AppError {
  constructor(
    message: string,
    public guardrailType: string,
    public enforcement: "soft" | "hard",
    public details?: {
      currentValue: number;
      threshold: number;
      envelopeId: string;
    },
  ) {
    super(enforcement === "hard" ? 409 : 200, message, "GUARDRAIL_VIOLATION");
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(403, message, "FORBIDDEN");
  }
}
