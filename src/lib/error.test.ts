import { describe, expect, it } from "vitest";
import { BackendErrorCode, toBackendErrorCode, type ApiError } from "./error";

describe("backend error contract", () => {
  it("maps known error code unchanged", () => {
    const code = toBackendErrorCode("PATH_COLLISION");
    expect(code).toBe(BackendErrorCode.PATH_COLLISION);
  });

  it("maps source lookup errors unchanged", () => {
    expect(toBackendErrorCode("SOURCE_RATE_LIMITED")).toBe(BackendErrorCode.SOURCE_RATE_LIMITED);
    expect(toBackendErrorCode("SOURCE_UNAUTHORIZED")).toBe(BackendErrorCode.SOURCE_UNAUTHORIZED);
  });

  it("maps unknown error to INTERNAL_ERROR", () => {
    const code = toBackendErrorCode("SOMETHING_NEW");
    expect(code).toBe(BackendErrorCode.INTERNAL_ERROR);
  });

  it("preserves typed api error shape", () => {
    const err: ApiError = {
      code: BackendErrorCode.INVALID_PATH,
      message: "Invalid path",
      details: { path: "/tmp/nope" }
    };

    expect(err.code).toBe("INVALID_PATH");
    expect(err.details).toEqual({ path: "/tmp/nope" });
  });
});
