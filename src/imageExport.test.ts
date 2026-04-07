import { describe, expect, it } from "vitest";
import { sanitizeImageFilename } from "./imageExport";

describe("sanitizeImageFilename", () => {
  it("creates a safe png filename from the chart title", () => {
    expect(sanitizeImageFilename("Role Assignment Operations")).toBe(
      "role-assignment-operations.png",
    );
    expect(sanitizeImageFilename("  ")).toBe("hillchart.png");
  });
});
