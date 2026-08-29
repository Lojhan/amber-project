import { type ServerType, serve } from "@hono/node-server";
import type { ApiApp } from "./types.js";

export type ListeningApi = Readonly<{
  close: () => Promise<void>;
}>;

const closeServer = (server: ServerType): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

export const listen = (
  app: ApiApp,
  hostname: string,
  port: number,
): Promise<ListeningApi> =>
  new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, hostname, port }, () =>
      resolve({ close: () => closeServer(server) }),
    );
    server.once("error", reject);
  });
