import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { lockedRepo } from "./workspace-lock.js";
import { readDiff, readNamedFile } from "./workspace-file.js";

const execFileAsync = promisify(execFile);

const ALLOW = [
  ["git", "status"],
  ["git", "diff"],
  ["pnpm", "test"],
  ["pnpm", "lint"],
] as const;

export type PoolImage = { data: string; type?: string };

export function userContent(prompt: string, images?: PoolImage[]): string | unknown[] {
  const photos = (images || [])
    .filter((img) => img.data && img.data.length < 1_500_000)
    .slice(0, 4);
  if (!photos.length) return prompt;
  return [
    { type: "text", text: prompt },
    ...photos.map((img) => ({
      type: "image_url",
      image_url: { url: `data:${img.type || "image/jpeg"};base64,${img.data}` },
    })),
  ];
}

export function matchCommand(cmd: string): string[] | null {
  const parts = cmd.trim().split(/\s+/);
  const hit = ALLOW.find(
    (row) => row.length === parts.length && row.every((part, i) => part === parts[i]),
  );
  return hit ? [...hit] : null;
}

export function diffPaths(diff: string): string[] | null {
  const paths: string[] = [];
  for (const line of diff.split(/\r?\n/)) {
    const m = /^(?:\+\+\+|---) [ab]\/(.+)$/.exec(line);
    if (!m?.[1] || m[1] === "/dev/null") continue;
    const rel = m[1].replace(/\\/g, "/");
    if (!rel || rel.startsWith("/") || /^[A-Za-z]:/.test(rel) || rel.split("/").includes(".."))
      return null;
    paths.push(rel);
  }
  return paths.length ? paths : null;
}

export async function applyLockedDiff(diff: string, root = lockedRepo().path): Promise<string> {
  const paths = diffPaths(diff);
  if (!paths) return "Rejected: diff paths must stay inside the locked repo.";
  const dir = await mkdtemp(join(tmpdir(), "iris-patch-"));
  const file = join(dir, "change.diff");
  try {
    await writeFile(file, diff);
    await execFileAsync("git", ["apply", "--check", file], { cwd: root, windowsHide: true });
    await execFileAsync("git", ["apply", file], { cwd: root, windowsHide: true });
    return `Applied ${paths.join(", ")}`;
  } catch (err) {
    return `Patch failed: ${err instanceof Error ? err.message : String(err)}. Fix the hunk and call propose_patch once more.`.slice(
      0,
      500,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function runLockedCommand(cmd: string, root = lockedRepo().path): Promise<string> {
  const argv = matchCommand(cmd);
  if (!argv) return "Rejected: command is not allowlisted.";
  if (resolve(root) !== resolve(lockedRepo().path))
    return "Rejected: command root is not the lock.";
  try {
    const { stdout, stderr } = await execFileAsync(argv[0]!, argv.slice(1), {
      cwd: root,
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 1_000_000,
    });
    return `${stdout}${stderr}`.trim().slice(0, 8000) || "(no output)";
  } catch (err) {
    return `Command failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500);
  }
}

export function fileWindow(text: string, startArg?: string, countArg?: string): string {
  const lines = text.split(/\r?\n/);
  const start = Math.min(lines.length, Math.max(1, Number(startArg) || 1));
  const count = Math.min(120, Math.max(1, Number(countArg) || 80));
  const slice = lines.slice(start - 1, start - 1 + count);
  const end = start + slice.length - 1;
  const body = slice.map((line, i) => `${start + i}|${line}`).join("\n");
  const more = end < lines.length ? `\nPass start=${end + 1} to read the next lines.` : "";
  return `${lines.length} lines, showing ${start}-${end}${more}\n${body}`;
}

export async function execPoolTool(
  name: string,
  args: Record<string, string>,
  root = lockedRepo().path,
): Promise<string> {
  if (name === "read_file") {
    const file = await readNamedFile(String(args.path || ""), root);
    return file
      ? `${file.path}\n${fileWindow(file.text, args.start, args.count)}`
      : "File not in the locked repo.";
  }
  if (name === "git_diff") {
    const diff = await readDiff(String(args.path || "."), root);
    return diff || "(no diff)";
  }
  return "Unknown tool.";
}

export const POOL_TOOLS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read a line window from a file in the locked repo. Lines are numbered. Pass start to read further down.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          start: { type: "string" },
          count: { type: "string" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_diff",
      description: "Show the git diff in the locked repo",
      parameters: { type: "object", properties: { path: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_patch",
      description: "Apply a unified diff in the locked repo immediately.",
      parameters: { type: "object", properties: { diff: { type: "string" } }, required: ["diff"] },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_command",
      description:
        "Propose git status, git diff, pnpm test, or pnpm lint. Iris runs it only after the user allows it.",
      parameters: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
      },
    },
  },
];
