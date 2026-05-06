import { describe, expect, it } from "vitest";
import { getPagination } from "./pagination";

describe("pagination", () => {
  it("uses default page size and computes first page range", () => {
    expect(getPagination({ totalItems: 30, pageSize: 24, currentPage: 1 })).toEqual({
      currentPage: 1,
      totalPages: 2,
      startIndex: 0,
      endIndex: 24,
      startItem: 1,
      endItem: 24
    });
  });

  it("clamps current page to nearest valid page", () => {
    expect(getPagination({ totalItems: 30, pageSize: 24, currentPage: 3 }).currentPage).toBe(2);
  });

  it("returns empty range for no items", () => {
    expect(getPagination({ totalItems: 0, pageSize: 24, currentPage: 1 })).toMatchObject({
      currentPage: 1,
      totalPages: 1,
      startItem: 0,
      endItem: 0
    });
  });
});
