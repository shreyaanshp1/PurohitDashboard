import { spawn } from "node:child_process";

const commands = [
  ["api", process.execPath, ["server/purchaseLoggerServer.mjs"]],
  ["web", "npm", ["run", "dev:web"]]
];

let shuttingDown = false;

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });

  child.on("exit", (code) => {
    if (code && !shuttingDown) {
      console.error(`${name} exited with code ${code}`);
      shutdown(code);
    }
  });

  return child;
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function shutdown(code) {
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }

  process.exit(code);
}
