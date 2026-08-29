import {
  createProductionApiRuntime,
  loadProductionApiConfig,
} from "@procurement/bootstrap/api";
import { loadConfig } from "./config.js";
import { listen } from "./node-server.js";
import { buildApi } from "./server.js";

export async function startApi(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<{ close(): Promise<void> }> {
  const config = loadConfig(environment);
  const runtime = await createProductionApiRuntime(
    loadProductionApiConfig(environment),
  );

  try {
    const app = buildApi(
      { config, composition: runtime.composition },
      runtime.health,
    );
    const server = await listen(app, config.HOST, config.PORT);
    console.info(`api listening on ${config.HOST}:${config.PORT}`);

    let closing: Promise<void> | undefined;
    return {
      close: () =>
        (closing ??= Promise.all([server.close(), runtime.close()]).then(
          () => undefined,
        )),
    };
  } catch (error) {
    await runtime.close();
    throw error;
  }
}

if (process.argv[1]?.endsWith("/main.ts")) {
  const runtime = await startApi();
  const close = () => void runtime.close().then(() => process.exit(0));
  process.once("SIGTERM", close);
  process.once("SIGINT", close);
}
