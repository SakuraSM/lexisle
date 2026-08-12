import { readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BUILD_DIRECTORY = fileURLToPath(new URL("../dist/client/", import.meta.url));
const MAX_BUILD_BYTES = 5 * 1024 * 1024;

async function directorySize(directory) {
  let total = 0;
  for (const name of await readdir(directory)) {
    const entry = path.join(directory, name);
    const details = await stat(entry);
    total += details.isDirectory() ? await directorySize(entry) : details.size;
  }
  return total;
}

const bytes = await directorySize(BUILD_DIRECTORY);
if (bytes > MAX_BUILD_BYTES) {
  throw new Error(`Build budget exceeded: ${(bytes / 1024 / 1024).toFixed(2)} MB > 5 MB`);
}
console.log(`Build budget: ${(bytes / 1024 / 1024).toFixed(2)} MB / 5 MB`);
