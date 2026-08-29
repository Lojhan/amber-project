export const INTERNAL_ALLOWED = {
  "@procurement/domain": new Set(),
  "@procurement/contracts": new Set(),
  "@procurement/decision": new Set(["@procurement/domain"]),
  "@procurement/application": new Set([
    "@procurement/decision",
    "@procurement/domain",
  ]),
  "@procurement/db": new Set(),
  "@procurement/persistence": new Set([
    "@procurement/application",
    "@procurement/db",
    "@procurement/domain",
  ]),
  "@procurement/storage": new Set([
    "@procurement/application",
    "@procurement/domain",
  ]),
  "@procurement/parser": new Set([
    "@procurement/application",
    "@procurement/domain",
  ]),
  "@procurement/agents": new Set([
    "@procurement/application",
    "@procurement/contracts",
    "@procurement/domain",
  ]),
  "@procurement/bootstrap": new Set([
    "@procurement/agents",
    "@procurement/application",
    "@procurement/db",
    "@procurement/domain",
    "@procurement/parser",
    "@procurement/persistence",
    "@procurement/storage",
  ]),
};

const APP_INTERNAL_ALLOWED = {
  "@procurement/api": new Set([
    "@procurement/bootstrap",
    "@procurement/contracts",
  ]),
  "@procurement/worker": new Set(["@procurement/bootstrap"]),
  "@procurement/web": new Set(["@procurement/contracts"]),
};

export const CORE_EXTERNAL_GATED = new Set([
  "@procurement/domain",
  "@procurement/contracts",
  "@procurement/application",
]);

const DATABASE_LIBRARIES = new Set(["pg", "pg-boss", "drizzle-orm"]);
const APP_FORBIDDEN = new Set([
  "@procurement/db",
  "@procurement/persistence",
  "@procurement/postgres",
  ...DATABASE_LIBRARIES,
]);

const dbLibrary = (specifier) =>
  [...DATABASE_LIBRARIES].find(
    (library) => specifier === library || specifier.startsWith(`${library}/`),
  );

export const packageTarget = (specifier) =>
  specifier.match(/^@procurement\/[^/]+/)?.[0] ?? dbLibrary(specifier);

export const checkDependency = ({
  app,
  targetApp,
  declared,
  file = "sample.ts",
}) => [
  ...(!declared ? [`${file}: dependency is not declared in package.json`] : []),
  ...(!app && targetApp ? [`${file}: packages may not import apps`] : []),
];

const addInternalEdgeDiagnostic = (diagnostics, packageName, target, file) => {
  const allowed = INTERNAL_ALLOWED[packageName];
  if (
    allowed &&
    target.startsWith("@procurement/") &&
    target !== packageName &&
    !allowed.has(target)
  )
    diagnostics.push(`${file}: ${packageName} may not depend on ${target}`);
};

const addAppEdgeDiagnostic = (diagnostics, packageName, target, file) => {
  const allowed = APP_INTERNAL_ALLOWED[packageName];
  if (
    allowed &&
    target.startsWith("@procurement/") &&
    target !== packageName &&
    !APP_FORBIDDEN.has(target) &&
    !allowed.has(target)
  )
    diagnostics.push(`${file}: ${packageName} may not depend on ${target}`);
};

export const checkLayerDependency = ({ packageName, app, specifier, file }) => {
  const target = packageTarget(specifier);
  if (!target) return [];
  const diagnostics = [];

  if (target === "@procurement/postgres")
    diagnostics.push(`${file}: obsolete @procurement/postgres is forbidden`);
  if (app && APP_FORBIDDEN.has(target))
    diagnostics.push(`${file}: apps may not depend on ${target}`);
  addInternalEdgeDiagnostic(diagnostics, packageName, target, file);
  addAppEdgeDiagnostic(diagnostics, packageName, target, file);

  if (
    DATABASE_LIBRARIES.has(target) &&
    packageName !== "@procurement/db" &&
    packageName !== "@procurement/persistence"
  )
    diagnostics.push(`${file}: only db or persistence may depend on ${target}`);

  return diagnostics;
};
