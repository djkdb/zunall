import "server-only";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AIProvider, AIRequest } from "./provider";
import { buildCliArgs, cliEnv } from "./cli-args";

/**
 * CLI 를 돌릴 빈 폴더. 앱 폴더에서 돌리면 저장소의 지침 파일·설정이 함께 읽히고,
 * 도구가 켜져 있었다면 앱 파일에도 손이 닿는다.
 */
function workDir(): string {
  const dir = path.join(os.tmpdir(), "cavero-claude-cli");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Claude CLI를 서버에서 실행하는 provider.
 *
 * 보안:
 * - shell을 거치지 않고 spawn(command, args)로 직접 실행 (command injection 차단)
 * - 사용자 입력(프롬프트)은 인자가 아닌 stdin으로 전달
 * - 타임아웃 시 프로세스 강제 종료
 * - 내장 도구·MCP 를 끄고, 빈 폴더에서, 앱 비밀값을 뺀 환경으로 실행 (cli-args.ts)
 */
export class ClaudeCliProvider implements AIProvider {
  readonly name = "claude";

  async complete(request: AIRequest): Promise<string> {
    const command = process.env.CLAUDE_COMMAND || "claude";
    const args = buildCliArgs(process.env.CLAUDE_ARGS);
    const timeoutMs = Number(process.env.CLAUDE_TIMEOUT) || 180_000;

    return new Promise<string>((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
        cwd: workDir(),
        env: cliEnv(process.env) as NodeJS.ProcessEnv,
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        reject(new Error(`Claude CLI 실행이 ${Math.round(timeoutMs / 1000)}초를 초과했습니다.`));
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf-8");
        if (stdout.length > 4_000_000) {
          settled = true;
          clearTimeout(timer);
          child.kill("SIGKILL");
          reject(new Error("Claude CLI 출력이 너무 큽니다."));
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf-8").slice(0, 4000);
      });

      child.on("error", (err: NodeJS.ErrnoException) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err.code === "ENOENT") {
          reject(
            new Error(
              `Claude CLI(${command})를 찾을 수 없습니다. 설치 여부를 확인하거나 AI_PROVIDER=mock으로 전환하세요.`,
            ),
          );
        } else {
          reject(new Error(`Claude CLI 실행 오류: ${err.message}`));
        }
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          reject(
            new Error(
              `Claude CLI가 비정상 종료되었습니다 (code ${code}). ${stderr.slice(0, 500)}`,
            ),
          );
        } else {
          resolve(stdout);
        }
      });

      // 프롬프트는 stdin으로만 전달
      child.stdin.write(request.prompt);
      child.stdin.end();
    });
  }
}
