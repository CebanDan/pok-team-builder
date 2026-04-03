import { describe, it, expect } from "vitest";
import { removePercentage } from "./string-utils";

describe("removePercentage", () => {
  it("removes a single percentage sign", () => {
    expect(removePercentage("52.75%")).toBe("52.75");
  });

  it("removes multiple percentage signs", () => {
    expect(removePercentage("10%%20%%%30")).toBe("102030");
  });

  it("handles consecutive percentage signs", () => {
    expect(removePercentage("%%%")).toBe("");
  });

  it("handles empty strings", () => {
    expect(removePercentage("")).toBe("");
  });

  it("handles null values", () => {
    // @ts-ignore - testing runtime null handling
    expect(removePercentage(null)).toBe("");
  });

  it("handles undefined values", () => {
    // @ts-ignore - testing runtime undefined handling
    expect(removePercentage(undefined)).toBe("");
  });

  it("preserves all other characters", () => {
    const input = "Hello World! @#$^&*()_+-=[]{}|;':\",.<>?/\\";
    expect(removePercentage(input)).toBe(input);
  });

  it("preserves spaces", () => {
    expect(removePercentage(" 10 % 20 % ")).toBe(" 10  20  ");
  });

  it("handles non-string inputs at runtime gracefully", () => {
    // @ts-ignore - testing runtime non-string handling
    expect(removePercentage(123)).toBe("");
    // @ts-ignore - testing runtime non-string handling
    expect(removePercentage({ foo: "bar" })).toBe("");
  });
});
