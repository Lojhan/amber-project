import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { runParserIsolated } from "../../src/isolation-runner.js";

const options = (script: string) => ({
  arguments: ["-e", script],
  // Workspace tests run in parallel; allow process startup to survive CPU contention.
  timeoutMs: 3_000,
  maxInputBytes: 5_000_000,
  maxOutputBytes: 5_000_000,
});

describe("isolated parser process", () => {
  it("round-trips a valid supplied workbook through a child boundary", async () => {
    const input = new Uint8Array(
      await readFile(new URL("../../../../quotation_1.xlsx", import.meta.url)),
    );
    const script = "process.stdin.pipe(process.stdout)";
    const result = await runParserIsolated(input, options(script));

    expect(result.ok).toBe(true);
    if (result.ok)
      expect(Buffer.from(result.output)).toEqual(Buffer.from(input));
  });

  it("kills a child after the hard timeout", async () => {
    const script = "setInterval(() => {}, 1000)";
    const result = await runParserIsolated(new Uint8Array(), {
      ...options(script),
      timeoutMs: 50,
    });
    expect(result).toEqual({ ok: false, code: "timeout" });
  });

  it("reports a child crash without throwing", async () => {
    const result = await runParserIsolated(
      new Uint8Array(),
      options("process.exit(7)"),
    );
    expect(result).toMatchObject({ ok: false, code: "crash", exitCode: 7 });
  });

  it("rejects oversized input before spawning", async () => {
    const result = await runParserIsolated(new Uint8Array(2), {
      ...options("process.exit(99)"),
      maxInputBytes: 1,
    });
    expect(result).toEqual({ ok: false, code: "input_limit" });
  });

  it("kills a child that exceeds its output allowance", async () => {
    const script = 'process.stdout.write("x".repeat(1000))';
    const result = await runParserIsolated(new Uint8Array(), {
      ...options(script),
      maxOutputBytes: 10,
    });
    expect(result).toEqual({ ok: false, code: "output_limit" });
  });

  it("reports executable spawn failures", async () => {
    const result = await runParserIsolated(new Uint8Array(), {
      ...options(""),
      executable: "/definitely/not/a/command",
    });
    expect(result).toMatchObject({ ok: false, code: "spawn_error" });
  });
});
