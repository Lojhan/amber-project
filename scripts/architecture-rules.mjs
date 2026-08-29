#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  checkAppSqlText,
  checkIndexText,
  checkProductionTests,
  checkRawSqlText,
  imports,
  parseSource,
} from "./architecture-ast.mjs";
import {
  CORE_EXTERNAL_GATED,
  checkDependency,
  checkLayerDependency,
  INTERNAL_ALLOWED,
  packageTarget,
} from "./architecture-policy.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const HTTP_FRAMEWORKS = ["express", "hono"];

const dirs = async (root) =>
  (await readdir(join(ROOT, root), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(ROOT, root, entry.name));

const files = async (dir) => {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && !["node_modules", "dist"].includes(entry.name))
      result.push(...(await files(path)));
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
      result.push(path);
  }
  return result;
};

const hasTests = async (dir) =>
  (await files(dir)).some((path) => /(\.test|\.spec)\.(ts|tsx)$/.test(path));

const testLocality = async (dir, label) => {
  const tests = (await files(dir)).filter((path) =>
    /(\.test|\.spec)\.(ts|tsx)$/.test(path),
  );
  return tests.length > 0 &&
    !tests.some((path) => /\/(src|test|tests)\//.test(path))
    ? [`${label}: tests must live under src/, test/, or tests/`]
    : [];
};

const dbFileDiagnostic = (file) => {
  const path = relative(ROOT, file);
  const allowed =
    /^packages\/db\/src\/(?:client|migrate-cli|schema)\.ts$/.test(path) ||
    /^packages\/db\/src\/schema\//.test(path);
  return allowed
    ? []
    : [`${path}: db may contain only schema, client, and migration code`];
};

const loadManifests = async (entries) => {
  const manifests = new Map();
  for (const dir of entries) {
    try {
      const manifest = JSON.parse(
        await readFile(join(dir, "package.json"), "utf8"),
      );
      manifests.set(manifest.name, {
        dir,
        manifest,
        app: dir.includes("/apps/"),
      });
    } catch {}
  }
  return manifests;
};

const importDiagnostic = ({
  file,
  source,
  manifest,
  manifests,
  app,
  specifier,
  node,
}) => {
  const target = packageTarget(specifier);
  if (!target) return [];
  const at =
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const location = `${relative(ROOT, file)}:${at}`;
  const diagnostics = [];

  if (!manifest.dependencies?.[target] && !manifest.devDependencies?.[target])
    diagnostics.push(`${location}: ${target} is not declared in package.json`);
  if (!app && manifests.get(target)?.app)
    diagnostics.push(`${location}: packages may not import apps`);
  diagnostics.push(
    ...checkLayerDependency({
      packageName: manifest.name,
      app,
      specifier,
      file: location,
    }),
  );
  if (
    manifest.name === "@procurement/bootstrap" &&
    /\/(api|worker)-composition\.ts$/.test(file) &&
    target.startsWith("@procurement/") &&
    target !== "@procurement/application"
  )
    diagnostics.push(
      `${location}: pure composition may depend only on application`,
    );
  if (
    manifest.name === "@procurement/db" &&
    [
      "@procurement/domain",
      "@procurement/application",
      "@procurement/persistence",
    ].includes(target)
  )
    diagnostics.push(`${location}: db may not import business packages`);
  if (
    manifest.name === "@procurement/persistence" &&
    HTTP_FRAMEWORKS.includes(specifier)
  )
    diagnostics.push(`${location}: persistence may not declare HTTP/routes`);

  return diagnostics;
};

const dependencyDiagnostics = (file, source, manifest, manifests, app) =>
  imports(source).flatMap(([specifier, node]) =>
    importDiagnostic({
      file,
      source,
      manifest,
      manifests,
      app,
      specifier,
      node,
    }),
  );

const manifestDependencyDiagnostics = ({ dir, manifest, app }) => {
  const diagnostics = [];
  const dependencies = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  });
  const location = `${relative(ROOT, dir)}/package.json`;

  for (const dependency of dependencies) {
    diagnostics.push(
      ...checkLayerDependency({
        packageName: manifest.name,
        app,
        specifier: dependency,
        file: location,
      }),
    );
    if (
      manifest.name === "@procurement/db" &&
      dependency.startsWith("@procurement/")
    )
      diagnostics.push(
        `${location}: db may not depend on business package ${dependency}`,
      );
    if (
      manifest.name === "@procurement/persistence" &&
      HTTP_FRAMEWORKS.includes(dependency)
    )
      diagnostics.push(
        `${location}: persistence may not depend on HTTP framework ${dependency}`,
      );
  }
  return diagnostics;
};

const coreManifestDiagnostics = ({ dir, manifest }) => {
  const allowed = INTERNAL_ALLOWED[manifest.name];
  if (!allowed) return [];
  const diagnostics = [];
  const dependencies = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  });
  const location = `${relative(ROOT, dir)}/package.json`;

  for (const dependency of dependencies) {
    if (dependency.startsWith("@procurement/") && !allowed.has(dependency))
      diagnostics.push(
        `${location}: core package dependency ${dependency} is not an allowed internal edge`,
      );
    if (
      CORE_EXTERNAL_GATED.has(manifest.name) &&
      !dependency.startsWith("@procurement/") &&
      !["vitest", "typescript", "zod"].includes(dependency)
    )
      diagnostics.push(
        `${location}: core package may not depend on external runtime package ${dependency}`,
      );
  }
  return diagnostics;
};

const fileDiagnostics = async (file, packageInfo, manifests) => {
  const { manifest, app } = packageInfo;
  const text = await readFile(file, "utf8");
  const source = parseSource(file, text);
  const path = relative(ROOT, file);
  const diagnostics = [];

  if (file.endsWith("/index.ts"))
    diagnostics.push(...checkIndexText(text, path));
  diagnostics.push(
    ...dependencyDiagnostics(file, source, manifest, manifests, app),
  );
  if (app) diagnostics.push(...checkAppSqlText(text, path));
  const allowlisted =
    manifest.name === "@procurement/persistence" &&
    /\/src\/pg-boss-bridge\.ts$/.test(path);
  if (!app && manifest.name !== "@procurement/db")
    diagnostics.push(...checkRawSqlText(text, path, allowlisted));
  if (manifest.name === "@procurement/db")
    diagnostics.push(...dbFileDiagnostic(file));

  return diagnostics;
};

const packageDiagnostics = async (packageInfo, manifests) => {
  const { dir } = packageInfo;
  const production = await files(join(dir, "src")).catch(() => []);
  const diagnostics = checkProductionTests(
    production.length > 0,
    await hasTests(dir),
    `${relative(ROOT, dir)}/src`,
  );
  diagnostics.push(...(await testLocality(dir, relative(ROOT, dir))));
  diagnostics.push(...manifestDependencyDiagnostics(packageInfo));
  diagnostics.push(...coreManifestDiagnostics(packageInfo));

  for (const file of production)
    diagnostics.push(...(await fileDiagnostics(file, packageInfo, manifests)));
  return diagnostics;
};

export async function checkArchitecture() {
  const entries = [...(await dirs("packages")), ...(await dirs("apps"))];
  const manifests = await loadManifests(entries);
  const diagnostics = [];
  for (const packageInfo of manifests.values())
    diagnostics.push(...(await packageDiagnostics(packageInfo, manifests)));
  return diagnostics;
}

export {
  checkAppSqlText,
  checkDependency,
  checkIndexText,
  checkLayerDependency,
  checkProductionTests,
  checkRawSqlText,
};
