import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { spawnSync } from "child_process";
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

function runBudgetHook(prompt: string, homeDir: string) {
  return spawnSync(process.execPath, ["plugin/hooks/budget-check.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, HOME: homeDir },
    input: JSON.stringify({ prompt }),
    encoding: "utf8",
  });
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

  it("accepts disabledSkills as an array when ensuring the default profile", async () => {
    const { module } = await importProfileModule();

    expect(() =>
      module.ensureDefaultProfile(["alpha", "beta"], ["beta"])
    ).not.toThrow();
    expect(module.loadProfile("default")).toEqual({
      name: "default",
      enabledSkills: ["alpha"],
    });
    expect(module.loadActiveProfile()).toBe("default");
  });

  it("records the active profile before a settings write failure", async () => {
    const { homeDir, module } = await importProfileModule();
    const settingsPath = join(homeDir, ".copilot", "settings.json");

    module.saveProfile("profile-a", ["alpha"]);
    module.saveProfile("profile-b", ["beta"]);
    module.saveActiveProfile("profile-a");

    mkdirSync(settingsPath, { recursive: true });

    expect(() => module.applyProfile("profile-b", ["alpha", "beta"])).toThrow();
    expect(module.loadActiveProfile()).toBe("profile-b");
  });

  it("preserves settings.json when the temporary atomic write fails", async () => {
    const { homeDir, module } = await importProfileModule();
    const copilotDir = join(homeDir, ".copilot");
    const settingsPath = join(copilotDir, "settings.json");

    module.saveProfile("profile-b", ["beta"]);
    mkdirSync(copilotDir, { recursive: true });
    writeFileSync(
      settingsPath,
      JSON.stringify({ disabledSkills: ["original"], other: true }, null, 2) + "\n",
      "utf8"
    );
    mkdirSync(`${settingsPath}.tmp`, { recursive: true });

    expect(() => module.applyProfile("profile-b", ["alpha", "beta"])).toThrow();
    expect(JSON.parse(readFileSync(settingsPath, "utf8"))).toEqual({
      disabledSkills: ["original"],
      other: true,
    });
  });

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

  it("returns a handled error for invalid profile names in the hook", async () => {
    const homeDir = join(
      repoRoot,
      ".test-home",
      `budget-check-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    const result = runBudgetHook("/skills-budget switch-profile ../bad", homeDir);

    expect(result.status).toBe(0);
    expect(result.error).toBeUndefined();
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    expect(JSON.parse(result.stdout)).toEqual({
      handled: true,
      handledBy: "skills-budget-guard",
      responseContent: '❌ Invalid profile name: "../bad"',
    });
  });

  it("passes through unrelated prompts", async () => {
    const homeDir = join(
      repoRoot,
      ".test-home",
      `budget-check-broken-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );

    const result = runBudgetHook("hello world", homeDir);

    expect(result.status).toBe(0);
    expect(result.error).toBeUndefined();
    expect(JSON.parse(result.stdout)).toEqual({});
  });

  it("normalises colon-format /skills-budget:list-profiles", async () => {
    const homeDir = join(
      repoRoot,
      ".test-home",
      `budget-check-colon-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    const result = runBudgetHook("/skills-budget:list-profiles", homeDir);

    expect(result.status).toBe(0);
    expect(result.error).toBeUndefined();
    const out = JSON.parse(result.stdout);
    expect(out).toMatchObject({
      handled: true,
      handledBy: "skills-budget-guard",
    });
    expect(out.responseContent).toMatch(/profile|Profile|No profiles/);
  });

  it.each([
    "Check my skills context budget and report any warnings",
    "/skills",
  ])("runs budget check for: %s", async prompt => {
    const homeDir = join(
      repoRoot,
      ".test-home",
      `budget-check-passthrough-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );

    const result = runBudgetHook(prompt, homeDir);

    expect(result.status).toBe(0);
    expect(result.error).toBeUndefined();
    expect(JSON.parse(result.stdout)).toMatchObject({
      handled: true,
      handledBy: "skills-budget-guard",
    });
    expect(JSON.parse(result.stdout).responseContent).toContain(
      "Skills context is within budget"
    );
  });

  it.each([
    "/skills-budget save-profile",
    "/skills-budget switch-profile",
    "/skills-budget delete-profile",
  ])("handles missing-argument command: %s", async prompt => {
    const homeDir = join(
      repoRoot,
      ".test-home",
      `budget-check-missing-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    const result = runBudgetHook(prompt, homeDir);

    expect(result.status).toBe(0);
    expect(result.error).toBeUndefined();
    expect(JSON.parse(result.stdout)).toMatchObject({
      handled: true,
      handledBy: "skills-budget-guard",
    });
    expect(JSON.parse(result.stdout).responseContent).toMatch(/Usage|No profile/);
  });
});
