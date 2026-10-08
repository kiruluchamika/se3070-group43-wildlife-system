import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  setup as start,
  teardown,
} from "../../backend/src/test-support/global-setup.mjs";
// Reuse the binary downloaded by backend/npm ci before attempting another download.
export async function setup() {
  const cache = fileURLToPath(
    new URL(
      "../../backend/node_modules/.cache/mongodb-memory-server/",
      import.meta.url,
    ),
  );
  if (!process.env.MONGOMS_SYSTEM_BINARY && existsSync(cache)) {
    const executable = readdirSync(cache).find(
      (name) =>
        name.startsWith("mongod-") &&
        (process.platform === "win32"
          ? name.endsWith(".exe")
          : !name.includes(".")),
    );
    if (executable)
      process.env.MONGOMS_SYSTEM_BINARY = fileURLToPath(
        new URL(
          `../../backend/node_modules/.cache/mongodb-memory-server/${executable}`,
          import.meta.url,
        ),
      );
  }
  await start();
}
export { teardown };
