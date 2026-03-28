import {
  AppError,
  NotFoundError,
  ValidationError,
  GuardrailError,
  AuthorizationError,
} from "../../src/shared/errors.js";

describe("AppError", () => {
  it("has correct statusCode, message, and code", () => {
    const err = new AppError(500, "Something broke", "INTERNAL");

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Something broke");
    expect(err.code).toBe("INTERNAL");
    expect(err.name).toBe("AppError");
  });

  it("works without optional code", () => {
    const err = new AppError(418, "I'm a teapot");
    expect(err.statusCode).toBe(418);
    expect(err.code).toBeUndefined();
  });
});

describe("NotFoundError", () => {
  it("has 404 status and NOT_FOUND code", () => {
    const err = new NotFoundError("User", "abc-123");

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("User with id abc-123 not found");
  });

  it("handles numeric ids", () => {
    const err = new NotFoundError("Order", 42);
    expect(err.message).toBe("Order with id 42 not found");
    expect(err.statusCode).toBe(404);
  });
});

describe("ValidationError", () => {
  it("has 400 status and VALIDATION_ERROR code", () => {
    const err = new ValidationError("Invalid input");

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Invalid input");
  });

  it("stores details when provided", () => {
    const details = { name: "Name is required", email: "Invalid email" };
    const err = new ValidationError("Validation failed", details);

    expect(err.details).toEqual(details);
  });

  it("has undefined details when not provided", () => {
    const err = new ValidationError("Bad data");
    expect(err.details).toBeUndefined();
  });
});

describe("GuardrailError", () => {
  it("returns 200 status for soft enforcement", () => {
    const err = new GuardrailError(
      "Budget warning",
      "total_comp",
      "soft",
      { currentValue: 450000, threshold: 500000, envelopeId: "env-1" },
    );

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(200);
    expect(err.code).toBe("GUARDRAIL_VIOLATION");
    expect(err.guardrailType).toBe("total_comp");
    expect(err.enforcement).toBe("soft");
  });

  it("returns 409 status for hard enforcement", () => {
    const err = new GuardrailError(
      "Headcount exceeded",
      "headcount",
      "hard",
      { currentValue: 11, threshold: 10, envelopeId: "env-2" },
    );

    expect(err.statusCode).toBe(409);
    expect(err.enforcement).toBe("hard");
    expect(err.details?.currentValue).toBe(11);
    expect(err.details?.threshold).toBe(10);
    expect(err.details?.envelopeId).toBe("env-2");
  });

  it("works without optional details", () => {
    const err = new GuardrailError("Warning", "comp_band", "soft");
    expect(err.statusCode).toBe(200);
    expect(err.details).toBeUndefined();
  });
});

describe("AuthorizationError", () => {
  it("has 403 status and FORBIDDEN code", () => {
    const err = new AuthorizationError();

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toBe("Insufficient permissions");
  });

  it("accepts custom message", () => {
    const err = new AuthorizationError("You cannot access this resource");
    expect(err.message).toBe("You cannot access this resource");
    expect(err.statusCode).toBe(403);
  });
});
