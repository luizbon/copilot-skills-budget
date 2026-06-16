import { chmodSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { afterEach, describe, expect, it } from "vitest";

const testFilePath = fileURLToPath(import.meta.url);
const repoRoot = dirname(dirname(testFilePath));
const originalHome = process.env.HOME;

async function importProfileModule() {
  const homeDir = join(
    repoRoot,
    ".test-home",
    `profile-hook-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  process.env.HOME = homeDir;

  const moduleUrl = new URL("../plugin/hooks/profile.mjs", import.meta.url);
  moduleUrl.searchParams.set("t", `${Date.now()}-${Math.random()}`);

  return {
    homeDir,
    module: await import(moduleUrl.href),
  };
}

afterEach(() => {
  process.env.HOME = originalHome;
  rmSync(join(repoRoot, ".test-home"), { recursive: true, force: true });
});

describe("profile hook", () => {
  it.each(["loadProfile", "saveProfile", "deleteProfile"] as const)(
    "rejects path traversal in %s",
    async methodName => {
      const { module } = await importProfileModule();

      expect(() => {
        if (methodName === "loadProfile") {
          module.loadProfile("../active-profile");
          return;
        }

        if (methodName === "saveProfile") {
          module.saveProfile("../active-profile", []);
          return;
        }

        module.deleteProfile("../active-profile");
      }).toThrow('Invalid profile name: "../active-profile"');
    }
  );

  it("surfaces directory permission errors from listProfiles", async () => {
    const { module } = await importProfileModule();

    mkdirSync(module.PROFILES_DIR, { recursive: true });
    writeFileSync(join(module.PROFILES_DIR, "default.json"), "{}\n", "utf8");
    chmodSync(module.PROFILES_DIR, 0o000);

    try {
      expect(() => module.listProfiles()).toThrow(/EACCES|EPERM/);
    } finally {
      chmodSync(module.PROFILES_DIR, 0o755);
    }
  });
});
