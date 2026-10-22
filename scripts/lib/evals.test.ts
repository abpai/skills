import { afterEach, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "eve-lanes-"));
  roots.push(root);
  mkdirSync(join(root, "evals/eve"), { recursive: true });
  const bin = join(root, "bin");
  mkdirSync(bin);
  for (const [name, script] of Object.entries({
    node: 'echo 24',
    docker: 'echo "docker $*" >> "$EVE_TEST_LOG"\nexit "${EVE_TEST_DOCKER_EXIT:-0}"',
    bun: [
      'echo "bun $*" >> "$EVE_TEST_LOG"',
      'if [ "$1" = run ]; then',
      '  echo "credentials:${OPENAI_API_KEY:+present}:${ANTHROPIC_API_KEY:+present}:${EVE_EVAL_PROVIDER:-}" >> "$EVE_TEST_LOG"',
      '  echo "progress: $2"',
      '  if [ "$2" = "${EVE_TEST_FAIL_SCRIPT:-}" ]; then exit 7; fi',
      'fi',
    ].join("\n"),
  })) {
    const path = join(bin, name);
    writeFileSync(path, `#!/bin/sh\n${script}\n`);
    chmodSync(path, 0o755);
  }
  return { root, bin, log: join(root, "commands.log") };
}

async function lane(part: string, extraEnv: Record<string, string> = {}) {
  const f = fixture();
  const module = join(import.meta.dir, "evals.ts");
  const reporter = join(import.meta.dir, "report.ts");
  const source = `import { evalsSmoke } from ${JSON.stringify(module)};
    import { Reporter } from ${JSON.stringify(reporter)};
    process.exit(await evalsSmoke(${JSON.stringify(f.root)}, new Reporter(), ${JSON.stringify(part)}));`;
  const proc = Bun.spawn([process.execPath, "-e", source], {
    env: {
      ...process.env, PATH: `${f.bin}:${process.env.PATH}`, EVE_TEST_LOG: f.log,
      OPENAI_API_KEY: "fixture-openai", ANTHROPIC_API_KEY: "fixture-anthropic", EVE_EVAL_PROVIDER: "openai",
      ...extraEnv,
    },
    stdout: "pipe", stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  return { code, output: stdout + stderr, commands: readFileSync(f.log, "utf8") };
}

test("fast checks complete without contacting Docker and strip provider credentials", async () => {
  const result = await lane("check", { EVE_TEST_DOCKER_EXIT: "1" });
  expect(result.code, result.output).toBe(0);
  for (const script of ["prepare-skills", "typecheck", "test:catalog", "test:coverage", "list"]) {
    expect(result.commands).toContain(`bun run ${script}\n`);
  }
  expect(result.commands).not.toContain("docker");
  expect(result.commands).not.toContain("outcome:pull");
  expect(result.commands).not.toContain("present");
  expect(result.commands).not.toContain("credentials:::openai");
});

test("integration retains isolation and mock boot without repeating fast checks", async () => {
  const result = await lane("integration");
  expect(result.code, result.output).toBe(0);
  for (const script of ["prepare-skills", "outcome:pull", "test:outcome-isolation", "eval:smoke"]) {
    expect(result.commands).toContain(`bun run ${script}\n`);
  }
  expect(result.commands).toContain("docker info");
  expect(result.commands).not.toContain("bun run typecheck");
  expect(result.commands).not.toContain("bun run list");
  expect(result.commands).not.toContain("present");
});

test("combined smoke reports fast checks before failing a missing Docker prerequisite", async () => {
  const result = await lane("smoke", { EVE_TEST_DOCKER_EXIT: "1" });
  expect(result.code, result.output).toBe(3);
  expect(result.commands.indexOf("bun run list")).toBeLessThan(result.commands.indexOf("docker info"));
  expect(result.commands).not.toContain("bun run outcome:pull");
  expect(result.output).toContain("evals integration not proven");
});

test("a failed check propagates failure and stops subsequent steps", async () => {
  const result = await lane("check", { EVE_TEST_FAIL_SCRIPT: "typecheck" });
  expect(result.code, result.output).toBe(1);
  expect(result.output).toContain("exit 7");
  expect(result.commands).not.toContain("bun run test:catalog");
});

test("a failed image pull prevents isolation and session boot from reporting success", async () => {
  const result = await lane("integration", { EVE_TEST_FAIL_SCRIPT: "outcome:pull" });
  expect(result.code, result.output).toBe(1);
  expect(result.output).toContain("progress: outcome:pull");
  expect(result.commands).not.toContain("bun run test:outcome-isolation");
  expect(result.commands).not.toContain("bun run eval:smoke");
});

test("stalled commands stream progress and time out with their descendants", async () => {
  const f = fixture();
  const sentinel = join(f.root, "descendant-survived");
  const childPath = join(f.root, "hang.ts");
  writeFileSync(childPath, `import { spawn } from "node:child_process";
    spawn(process.execPath, ["-e", ${JSON.stringify(`setTimeout(() => { require("node:fs").writeFileSync(${JSON.stringify(sentinel)}, "alive"); }, 3000);`)}], { stdio: "inherit" });
    console.log("visible progress before timeout");
    setInterval(() => {}, 1000);`);
  const module = join(import.meta.dir, "eval-command.ts");
  const source = `import { runEvalCommand } from ${JSON.stringify(module)};
    process.exit(await runEvalCommand([process.execPath, ${JSON.stringify(childPath)}], {
      cwd: ${JSON.stringify(f.root)}, label: "stalled Docker fixture", timeoutMs: 1500,
    }));`;
  const proc = Bun.spawn([process.execPath, "-e", source], { stdout: "pipe", stderr: "pipe" });
  let exited = false;
  void proc.exited.then(() => { exited = true; });
  const reader = proc.stdout.getReader();
  let output = "";
  while (!output.includes("visible progress before timeout")) {
    const chunk = await reader.read();
    if (chunk.done) break;
    output += new TextDecoder().decode(chunk.value);
  }
  expect(output).toContain("visible progress before timeout");
  expect(exited).toBe(false);
  expect(await proc.exited).toBe(124);
  expect(await new Response(proc.stderr).text()).toContain("timed out after 1.5s");
  await Bun.sleep(1800);
  expect(existsSync(sentinel)).toBe(false);
}, 10_000);
