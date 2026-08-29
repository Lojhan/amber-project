import { describe, expect, it, vi } from "vitest";
import { OpenAICommercialNoteInterpreter } from "./commercial-note-interpreter.js";

describe("OpenAICommercialNoteInterpreter", () => {
  it("does not call the provider when no note exists", async () => {
    const parse = vi.fn();
    const interpreter = new OpenAICommercialNoteInterpreter({
      responses: { parse },
    });

    await expect(interpreter.interpret(null)).resolves.toMatchObject({
      source: "default",
      primaryPriority: null,
      hardMaxLeadDays: null,
    });
    expect(parse).not.toHaveBeenCalled();
  });

  it("accepts only a structured interpretation and marks its source", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        primaryPriority: "quality",
        hardMaxLeadDays: 30,
        summary: "Quality is primary and delivery must be within 30 days.",
        warnings: [],
      },
    });
    const interpreter = new OpenAICommercialNoteInterpreter({
      responses: { parse },
    });

    await expect(
      interpreter.interpret(
        "Choose the highest quality option and deliver within 30 days.",
      ),
    ).resolves.toEqual({
      primaryPriority: "quality",
      hardMaxLeadDays: 30,
      summary: "Quality is primary and delivery must be within 30 days.",
      warnings: [],
      source: "ai",
    });
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("rejects provider output outside the supported policy bounds", async () => {
    const interpreter = new OpenAICommercialNoteInterpreter({
      responses: {
        parse: vi.fn().mockResolvedValue({
          output_parsed: {
            primaryPriority: "lead_time",
            hardMaxLeadDays: 90,
            summary: "Deliver within 90 days.",
            warnings: [],
          },
        }),
      },
    });

    await expect(interpreter.interpret("Maximum 90 days")).rejects.toThrow(
      "invalid commercial note response",
    );
  });
});
