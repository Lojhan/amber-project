# Local tooling

The repository uses Node 24 and pnpm 10.12.4. Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm check
```

Biome owns formatting and linting for tracked source/configuration files. It enforces a 300-line file limit, an 80-line function limit, cognitive-complexity warnings, and no production `any` (SDK boundaries must use a narrow adapter type). The frozen challenge inputs, spreadsheets, and CSV are intentionally excluded from Biome.

The architecture gate keeps `index.ts` files as export-only barrels, checks workspace dependency declarations, enforces the layer dependency direction, and rejects direct SQL outside the persistence bridge. Biome owns all style and readability decisions; there is no second custom formatting dialect.

The web API uses the generated OpenAPI `paths` type for its endpoint catalogue. A catalogue entry must use a generated path and the verb published for that path; JSON command bodies and successful response decoders are inferred from the same generated operation. This makes path/verb/body/response drift a TypeScript error, while Zod schemas still validate untrusted runtime payloads.

The hosted CodeQL workflow is `.github/workflows/codeql.yml` and uses GitHub's maintained `security-and-quality` query suite. The challenge does not ship or install a multi-gigabyte local CodeQL toolchain.
