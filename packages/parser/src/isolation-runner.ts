import { spawn } from "node:child_process";

export type IsolationFailureCode =
  | "crash"
  | "input_limit"
  | "output_limit"
  | "spawn_error"
  | "timeout";

export type IsolationResult =
  | { ok: true; output: Uint8Array }
  | {
      ok: false;
      code: IsolationFailureCode;
      detail?: string;
      exitCode?: number;
    };

export interface IsolationOptions {
  executable?: string;
  arguments: readonly string[];
  timeoutMs: number;
  maxInputBytes: number;
  maxOutputBytes: number;
}

export async function runParserIsolated(
  input: Uint8Array,
  options: IsolationOptions,
): Promise<IsolationResult> {
  if (input.byteLength > options.maxInputBytes) {
    return { ok: false, code: "input_limit" };
  }

  return runChild(input, options);
}

function runChild(
  input: Uint8Array,
  options: IsolationOptions,
): Promise<IsolationResult> {
  return new Promise((resolve) => {
    const child = spawn(
      options.executable ?? process.execPath,
      options.arguments,
      {
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;

    const finish = (result: IsolationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const terminate = (result: IsolationResult) => {
      child.kill("SIGKILL");
      finish(result);
    };
    const timer = setTimeout(
      () => terminate({ ok: false, code: "timeout" }),
      options.timeoutMs,
    );

    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength;

      if (outputBytes > options.maxOutputBytes) {
        terminate({ ok: false, code: "output_limit" });
        return;
      }
      output.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (Buffer.concat(errors).byteLength < 4_096) errors.push(chunk);
    });
    child.on("error", (error) => {
      finish({ ok: false, code: "spawn_error", detail: error.message });
    });
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        finish({
          ok: false,
          code: "crash",
          ...(code === null ? {} : { exitCode: code }),
          detail: Buffer.concat(errors).toString("utf8").slice(0, 4_096),
        });
        return;
      }
      finish({ ok: true, output: Buffer.concat(output) });
    });

    child.stdin.on("error", () => undefined);
    child.stdin.end(input);
  });
}
