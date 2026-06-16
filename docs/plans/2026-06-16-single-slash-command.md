# Single /skills-budget Slash Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Register `/skills-budget` as a single slash command that appears in the CLI autocomplete and dispatches subcommands (`list-profiles`, `save-profile <name>`, etc.) via the hook — no model involved.

**Architecture:** Add one command file (`plugin/commands/skills-budget.md`) with `disable-model-invocation: true`. This registers the slash command in the CLI without triggering the model. The existing `userPromptSubmitted` hook in `budget-check.mjs` receives the full prompt (e.g. `/skills-budget list-profiles`) and dispatches it. Remove the `/update-skills-budget` command and all update-check machinery.

**Tech Stack:** Node.js ESM hook, Copilot CLI plugin system (`plugin.json`, `.md` command files), Vitest tests.

---

### Task 1: Create the commands directory and command file

**Files:**
- Create: `plugin/commands/skills-budget.md`

**Step 1: Create the directory and file**

```bash
mkdir -p plugin/commands
```

Create `plugin/commands/skills-budget.md` with this exact content:

```markdown
---
description: "Manage skill profiles. Usage: /skills-budget <list-profiles | save-profile <name> | switch-profile <name> | update-profile | delete-profile <name>>"
disable-model-invocation: true
---
```

No body content — the frontmatter is all that's needed.

**Step 2: Verify the file exists**

```bash
cat plugin/commands/skills-budget.md
```

Expected: the file content above.

---

### Task 2: Register the commands directory in plugin.json

**Files:**
- Modify: `plugin/plugin.json`

**Step 1: Add `commands` field**

In `plugin/plugin.json`, add `"commands": "./commands"` after `"mcpServers": {}`:

```json
{
  "name": "skills-budget",
  ...
  "hooks": "./hooks/hooks.json",
  "mcpServers": {},
  "commands": "./commands"
}
```

**Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('plugin/plugin.json','utf8')); console.log('valid')"
```

Expected: `valid`

---

### Task 3: Remove /update-skills-budget and update-check from the hook

**Files:**
- Modify: `plugin/hooks/budget-check.mjs`

The goal is to delete all code related to the update command. Specifically remove:

1. **Imports no longer needed** (if they become unused after removal):
   - `writeFileSync`, `mkdirSync`, `cpSync`, `rmSync` from `'fs'`
   - `execFileSync` from `'child_process'`
   - `tmpdir` from `'os'`

2. **Constants** (lines ~12-14):
   ```js
   const UPDATE_COMMAND = '/update-skills-budget';
   const REPO = 'luizbon/copilot-skills-budget';
   const GITHUB_API = `https://api.github.com/repos/${REPO}/releases/latest`;
   ```

3. **Functions** `getCurrentVersion`, `semverGt`, `checkForUpdate`, and the `handleUpdate` block (lines ~163-256).

4. **The dispatch block** (around line 253):
   ```js
   if (prompt === UPDATE_COMMAND) {
     await handleUpdate(respond);
   }
   ```

5. **`updateNoticePromise`** (line ~367) and all `updateNotice` usages in the two `respond()` calls in the budget check section. Replace `...${updateNotice}` with nothing in both respond calls.

**Step 1: Remove all update-related code** (edit the file)

After editing, verify imports are still correct — `readFileSync`, `readdirSync` from `'fs'` and `homedir` from `'os'` are still needed.

**Step 2: Verify no syntax errors**

```bash
node --check plugin/hooks/budget-check.mjs
```

Expected: no output (no errors)

---

### Task 4: Add colon-format normalisation to the hook

**Files:**
- Modify: `plugin/hooks/budget-check.mjs`

When the user selects `/skills-budget` from autocomplete and appends ` list-profiles`, the CLI may pass the prompt as `/skills-budget list-profiles`. But if it passes it as `/skills-budget:list-profiles` (colon format), the hook must normalise it.

**Step 1: Find the profile command detection line**

Locate:
```js
const isProfileCommand = prompt.startsWith('/skills-budget ');
```

**Step 2: Add normalisation before it**

Replace that line with:
```js
// Normalise colon format from autocomplete: /skills-budget:list-profiles → /skills-budget list-profiles
const normalizedPrompt = prompt.replace(/^\/skills-budget:(\S*)(.*)/, '/skills-budget $1$2');
const isProfileCommand = normalizedPrompt.startsWith('/skills-budget ');
```

**Step 3: Replace all uses of `prompt` in the profile dispatch block with `normalizedPrompt`**

The dispatch block starts at `if (isProfileCommand) {` and ends at its closing `}`. Change every reference to `prompt` inside this block to `normalizedPrompt`. The references are:
- `if (normalizedPrompt === '/skills-budget list-profiles')`
- `if (normalizedPrompt.startsWith('/skills-budget save-profile'))`
- `const name = normalizedPrompt.slice(...).trim()`  (for each subcommand)
- `if (normalizedPrompt === '/skills-budget update-profile')`
- `if (normalizedPrompt.startsWith('/skills-budget switch-profile'))`
- `if (normalizedPrompt.startsWith('/skills-budget delete-profile'))`

Also update the early-exit guard that currently uses `prompt`:
```js
if (!isSkillsCommand && prompt !== STARTUP_PROMPT && !isProfileCommand) {
```
Change `prompt` to `normalizedPrompt`:
```js
if (!isSkillsCommand && normalizedPrompt !== STARTUP_PROMPT && !isProfileCommand) {
```

**Step 4: Verify no syntax errors**

```bash
node --check plugin/hooks/budget-check.mjs
```

Expected: no output

---

### Task 5: Update tests

**Files:**
- Modify: `test/profile-hook.test.ts`

**Step 1: Remove update-related tests**

Search for and delete any tests that reference `UPDATE_COMMAND`, `update-skills-budget`, `checkForUpdate`, or the update flow. (There may be none if those were never added to this test file — skip if so.)

**Step 2: Add a test for colon-format normalisation**

Add to the `profile hook` describe block:

```typescript
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
  expect(out).toMatchObject({ handled: true, handledBy: "skills-budget-guard" });
  expect(out.responseContent).toMatch(/profile|Profile|No profiles/);
});
```

**Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass

---

### Task 6: Bump version and update marketplace.json

**Files:**
- Modify: `plugin/plugin.json` — bump `version` to `0.2.1`
- Modify: `.github/plugin/marketplace.json` — bump `version` to `0.2.1`

```bash
sed -i '' 's/"version": "0.2.0"/"version": "0.2.1"/' plugin/plugin.json .github/plugin/marketplace.json
```

Verify:
```bash
grep '"version"' plugin/plugin.json .github/plugin/marketplace.json
```

---

### Task 7: Commit, tag, and push

**Step 1: Stage all changes**

```bash
git add plugin/commands/ plugin/plugin.json plugin/hooks/budget-check.mjs .github/plugin/marketplace.json test/profile-hook.test.ts
```

**Step 2: Commit**

```bash
git commit -m "feat: register /skills-budget as single slash command with disable-model-invocation

Add plugin/commands/skills-budget.md with disable-model-invocation: true.
This registers /skills-budget in the CLI autocomplete without invoking
the model — the userPromptSubmitted hook handles all dispatch in code.

Add colon-format normalisation so /skills-budget:list-profiles (CLI
autocomplete format) is treated identically to /skills-budget list-profiles.

Remove /update-skills-budget command and all update-check machinery
(getCurrentVersion, semverGt, checkForUpdate, handleUpdate).

Bump to v0.2.1.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

**Step 3: Tag and push**

```bash
git tag -a v0.2.1 -m "v0.2.1 - Single /skills-budget slash command, code-only dispatch"
git push && git push origin v0.2.1
```
