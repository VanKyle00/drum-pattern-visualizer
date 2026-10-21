import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./service";
const root = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer({
  assets: path.join(root, "dist"),
  jobsRoot: path.join(root, ".render-jobs"),
  port: Number(process.env.PORT || 4173),
  dev: process.argv.includes("--dev"),
});
console.log("Drum Canvas ready at " + server.origin);
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await server.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
