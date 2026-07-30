#!/usr/bin/env node
// Runs the TypeScript CLI directly via tsx so a git install needs no build step.
// tsx resolves tsconfig from the consumer's cwd by default, so pin it to this
// package's config to keep the react-jsx transform when installed elsewhere.
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

process.env.TSX_TSCONFIG_PATH ??= fileURLToPath(
  new URL("../tsconfig.json", import.meta.url),
);
register();
await import("../src/cli.ts");
