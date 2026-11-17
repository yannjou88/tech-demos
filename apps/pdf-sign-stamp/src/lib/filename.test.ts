import { describe, expect, test } from "bun:test";
import { signedFileName } from "./filename";

describe("signedFileName", () => {
  test("appends -signed before the pdf extension", () => {
    expect(signedFileName("order.pdf")).toBe("order-signed.pdf");
    expect(signedFileName("my.file.PDF")).toBe("my.file-signed.pdf");
  });

  test("keeps a name that is not a pdf extension", () => {
    expect(signedFileName("receipt")).toBe("receipt-signed.pdf");
  });

  test("falls back when the name is blank", () => {
    expect(signedFileName("  ")).toBe("document-signed.pdf");
  });
});
