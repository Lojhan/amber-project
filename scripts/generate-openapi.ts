import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { apiDocument, buildApi } from "../apps/api/src/server.js";
import { createDependencies } from "../apps/api/src/test-support.js";

const generate = async (): Promise<void> => {
  const output = process.env.OPENAPI_OUTPUT
    ? resolve(process.env.OPENAPI_OUTPUT)
    : new URL("../packages/contracts/openapi.json", import.meta.url);
  const outputPath =
    typeof output === "string" ? output : fileURLToPath(output);
  const document = apiDocument(buildApi(createDependencies()));
  await mkdir(new URL("../apps/web/src/lib/api/", import.meta.url), {
    recursive: true,
  });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
  await new Promise<void>((resolveFormat, rejectFormat) => {
    execFile(
      "pnpm",
      ["exec", "biome", "format", "--write", outputPath],
      (error) => (error ? rejectFormat(error) : resolveFormat()),
    );
  });
};

void generate();
