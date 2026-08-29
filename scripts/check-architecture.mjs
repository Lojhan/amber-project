#!/usr/bin/env node
import {
  checkAppSqlText,
  checkArchitecture,
  checkDependency,
  checkIndexText,
  checkLayerDependency,
  checkProductionTests,
  checkRawSqlText,
} from "./architecture-rules.mjs";

const selfTest = () => {
  const invalid =
    checkIndexText("export { value } from './value';").length ||
    checkIndexText("import { value } from './value';").length !== 1 ||
    checkIndexText("const value = 1;").length !== 1 ||
    checkProductionTests(true, false).length !== 1 ||
    checkProductionTests(true, true).length ||
    checkDependency({ app: false, targetApp: true, declared: true }).length !==
      1 ||
    checkDependency({ app: true, targetApp: false, declared: false }).length !==
      1 ||
    checkLayerDependency({
      packageName: "@procurement/application",
      app: false,
      specifier: "@procurement/persistence",
      file: "application.ts",
    }).length !== 1 ||
    checkLayerDependency({
      packageName: "@procurement/persistence",
      app: false,
      specifier: "@procurement/db",
      file: "persistence.ts",
    }).length ||
    checkLayerDependency({
      packageName: "@procurement/persistence",
      app: false,
      specifier: "@procurement/parser",
      file: "persistence.ts",
    }).length !== 1 ||
    checkLayerDependency({
      packageName: "@procurement/api",
      app: true,
      specifier: "@procurement/application",
      file: "api.ts",
    }).length !== 1 ||
    checkLayerDependency({
      packageName: "@procurement/db",
      app: false,
      specifier: "@procurement/domain",
      file: "db.ts",
    }).length !== 1 ||
    checkLayerDependency({
      packageName: "@procurement/api",
      app: true,
      specifier: "pg",
      file: "api.ts",
    }).length !== 2 ||
    checkLayerDependency({
      packageName: "@procurement/api",
      app: true,
      specifier: "@procurement/postgres",
      file: "api.ts",
    }).length !== 2 ||
    checkAppSqlText("database.query('select 1')", "api.ts").length !== 1 ||
    checkAppSqlText("transactions.clientFor(transaction)", "api.ts").length !==
      1 ||
    checkAppSqlText("db.execute('SELECT 1')", "api.ts").length !== 1 ||
    checkAppSqlText("handler.execute('select 1')", "api.ts").length ||
    checkAppSqlText("const text = 'update the record'", "api.ts").length ||
    checkRawSqlText("db.query('SELECT 1')", "db.ts").length !== 1 ||
    checkRawSqlText("db.query('select 1')", "migration.ts", true).length ||
    checkRawSqlText("service.query('SELECT 1')", "api.ts").length ||
    checkLayerDependency({
      packageName: "@procurement/application",
      app: false,
      specifier: "@procurement/contracts",
      file: "application.ts",
    }).length !== 1 ||
    checkLayerDependency({
      packageName: "@procurement/api",
      app: true,
      specifier: "@procurement/persistence",
      file: "api.ts",
    }).length !== 1 ||
    checkAppSqlText("service.get()", "api.ts").length;
  if (invalid) throw new Error("architecture checker self-test failed");
};

if (process.argv.includes("--self-test")) {
  selfTest();
  console.log("architecture self-test passed");
} else {
  const diagnostics = await checkArchitecture();
  if (diagnostics.length) {
    console.error(diagnostics.join("\n"));
    process.exitCode = 1;
  }
}
