import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";

function currentGitSha() {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA;
  }

  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

const gitSha = currentGitSha();
const repositoryUrl = process.env.GITHUB_REPOSITORY
  ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${process.env.GITHUB_REPOSITORY}`
  : "https://github.com/romanenko-cn/hillchart";

export default defineConfig({
  plugins: [react()],
  base: "/hillchart/",
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GIT_SHA__: JSON.stringify(gitSha),
    __GIT_COMMIT_URL__: JSON.stringify(`${repositoryUrl}/commit/${gitSha}`),
  },
  test: {
    environment: "jsdom",
  },
});
