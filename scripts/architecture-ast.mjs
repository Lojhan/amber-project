import ts from "typescript";

export const imports = (source) => {
  const result = [];
  const visit = (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      result.push([node.moduleSpecifier.text, node]);
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      result.push([node.moduleSpecifier.text, node]);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require")) &&
      ts.isStringLiteral(node.arguments[0])
    )
      result.push([node.arguments[0].text, node]);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
};

const parse = (text, file) =>
  ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

export function checkIndexText(text, file = "index.ts") {
  const source = parse(text, file);
  return source.statements.some(
    (node) => !ts.isExportDeclaration(node) && !ts.isEmptyStatement(node),
  )
    ? [`${file}: index.ts must be an export-only barrel`]
    : [];
}

export const checkProductionTests = (hasProduction, hasTests, label = "src") =>
  hasProduction && !hasTests
    ? [`${label}: production code requires tests`]
    : [];

const isDbReceiver = (receiver) => {
  if (ts.isIdentifier(receiver))
    return /^(db|database|client|pool|transactions|transaction)$/i.test(
      receiver.text,
    );
  return (
    ts.isPropertyAccessExpression(receiver) &&
    /^(db|database|client|pool|transactions|transaction)$/i.test(
      receiver.name.text,
    )
  );
};

const isDbCall = (node, includeClientFor = false) =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  [
    "query",
    "execute",
    "executeQuery",
    ...(includeClientFor ? ["clientFor"] : []),
    "unsafe",
  ].includes(node.expression.name.text) &&
  isDbReceiver(node.expression.expression);

const lineFor = (source, node) =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

export function checkAppSqlText(text, file = "sample.ts") {
  const source = parse(text, file);
  const diagnostics = [];
  const visit = (node) => {
    if (isDbCall(node, true))
      diagnostics.push(
        `${file}:${lineFor(source, node)}: apps may not execute database query/clientFor calls`,
      );
    ts.forEachChild(node, visit);
  };
  visit(source);
  return diagnostics;
}

const hasSqlLiteral = (node) =>
  node.arguments.some(
    (argument) =>
      (ts.isStringLiteral(argument) ||
        ts.isNoSubstitutionTemplateLiteral(argument)) &&
      /\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE)\b/i.test(argument.text),
  );

export function checkRawSqlText(text, file = "sample.ts", allowlisted = false) {
  if (allowlisted) return [];
  const source = parse(text, file);
  const diagnostics = [];
  const visit = (node) => {
    if (isDbCall(node) && hasSqlLiteral(node))
      diagnostics.push(
        `${file}:${lineFor(source, node)}: raw SQL/query execution is restricted to db migrations or allowlisted persistence bridges`,
      );
    ts.forEachChild(node, visit);
  };
  visit(source);
  return diagnostics;
}

export const parseSource = (file, text) => parse(text, file);
