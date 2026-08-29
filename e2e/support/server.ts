import { createServer, type IncomingMessage, type Server } from "node:http";
import { asBrandId } from "@procurement/domain";
import { listen } from "../../apps/api/src/node-server.js";
import { buildApi } from "../../apps/api/src/server.js";
import {
  createDependencies,
  testBrandId,
} from "../../apps/api/src/test-support.js";
import { createE2eComposition } from "./services.js";
import { createE2eState, type E2eState, ids } from "./state.js";

const state: E2eState = createE2eState();
const apiPort = Number(process.env.E2E_API_PORT ?? 3101);
const uploadPort = Number(process.env.E2E_UPLOAD_PORT ?? 3102);

const reviewReasonsFor = (missingQuantity: boolean, ambiguousRole: boolean) => {
  if (missingQuantity) return ["missing_requested_quantity" as const];
  if (ambiguousRole) return ["ambiguous_commercial_fields" as const];
  return [];
};

const matchLabelFor = (
  parsed: E2eState["parsed"],
  missingQuantity: boolean,
  ambiguousRole: boolean,
) => {
  if (missingQuantity) return "Review required: missing requested quantity";
  if (ambiguousRole) return "Review required: field-role ambiguity";
  return (
    parsed?.scenarios
      .flatMap((scenario) => scenario.lines)
      .find((line) => line.sku?.value === "AQ009-0BS-XS")?.sku?.value ??
    parsed?.scenarios[0]?.lines[0]?.sku?.value ??
    "Parsed line"
  );
};

const project = () => {
  const parsed = state.parsed;
  const missingQuantity =
    !state.quantitiesReviewed &&
    Boolean(
      parsed?.scenarios.some((scenario) =>
        scenario.lines.some((line) => line.quantityCandidates.length === 0),
      ),
    );
  const ambiguousRole = Boolean(
    parsed?.scenarios.some((scenario) =>
      scenario.lines.some((line) => line.fieldRoleStatus === "ambiguous"),
    ),
  );
  const blocked = missingQuantity || ambiguousRole;

  return {
    id: ids.quotation,
    status: blocked ? "REVIEW_REQUIRED" : "READY",
    ...(state.selectedScenarioId
      ? { selectedScenarioId: state.selectedScenarioId }
      : {}),
    ...(state.negotiationStarted ? { negotiationId: ids.negotiation } : {}),
    scenarios: (parsed?.scenarios ?? []).map((scenario, index) => ({
      id: index === 1 ? ids.scenario2 : ids.scenario1,
      label: scenario.label ?? `Scenario ${index + 1}`,
      evidence: scenario.sourceRegions[0]?.sheet,
    })),
    matches: [
      {
        id: ids.match,
        lineId: ids.match,
        scenarioId:
          parsed?.scenarios.length === 1 ? ids.scenario1 : ids.scenario2,
        label: matchLabelFor(parsed, missingQuantity, ambiguousRole),
        matchReady: true,
        status: blocked || state.quantitiesReviewed ? "RESOLVED" : "PENDING",
        ...(missingQuantity ? { minimumOrderQuantity: "1" } : {}),
        reviewReasons: reviewReasonsFor(missingQuantity, ambiguousRole),
        candidates: blocked
          ? []
          : [
              {
                productId: ids.product,
                sku: "AQ009-0BS-XS",
                name: "Catalog product",
                score: 0.98,
              },
            ],
      },
    ],
  };
};

const dependencies = createDependencies({
  composition: createE2eComposition(state, project, asBrandId(testBrandId)),
});

const requestBody = (request: IncomingMessage): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });

const createUploadServer = (): Server =>
  createServer(async (request, response) => {
    if (request.method !== "PUT" || !request.url?.startsWith("/e2e-upload/")) {
      response.writeHead(404).end();
      return;
    }

    state.bytes = await requestBody(request);
    response.writeHead(200).end();
  });

const listenUploadServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(uploadPort, "127.0.0.1", resolve);
  });

const closeUploadServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const main = async (): Promise<void> => {
  const api = await listen(buildApi(dependencies), "127.0.0.1", apiPort);
  const uploadServer = createUploadServer();
  await listenUploadServer(uploadServer);
  process.once(
    "SIGTERM",
    () => void Promise.all([api.close(), closeUploadServer(uploadServer)]),
  );
};

void main();
