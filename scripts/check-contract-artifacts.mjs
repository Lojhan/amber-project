import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = (command, args, env = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });

const directory = await mkdtemp(join(tmpdir(), "procurement-openapi-"));
try {
  const document = join(directory, "openapi.json");
  const client = join(directory, "generated.ts");
  await run("pnpm", ["exec", "tsx", "scripts/generate-openapi.ts"], {
    OPENAPI_OUTPUT: document,
  });
  await run("pnpm", ["exec", "openapi-typescript", document, "-o", client]);
  const [expectedDocument, actualDocument, expectedClient, actualClient] =
    await Promise.all([
      readFile(document),
      readFile("packages/contracts/openapi.json"),
      readFile(client),
      readFile("apps/web/src/lib/api/generated.ts"),
    ]);
  if (
    !expectedDocument.equals(actualDocument) ||
    !expectedClient.equals(actualClient)
  )
    throw new Error(
      "OpenAPI/client artifacts are stale; run pnpm openapi:generate.",
    );
} finally {
  await rm(directory, { recursive: true, force: true });
}
