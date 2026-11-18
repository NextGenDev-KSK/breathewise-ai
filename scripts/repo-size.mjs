// Verifies the tracked repository stays well below the 10 MB competition limit.
// Usage: npm run repo:size   (exits 1 if tracked files exceed LIMIT_MB)
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";

const LIMIT_MB = 9;
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
let total = 0;
const sizes = [];
for (const f of files) {
  try {
    const size = statSync(f).size;
    total += size;
    sizes.push([size, f]);
  } catch {
    /* deleted in working tree */
  }
}
sizes.sort((a, b) => b[0] - a[0]);
const mb = (b) => (b / 1024 / 1024).toFixed(2);
console.log(`Tracked files: ${files.length}`);
console.log(`Tracked size:  ${mb(total)} MB (limit ${LIMIT_MB} MB)`);
console.log("Largest files:");
for (const [s, f] of sizes.slice(0, 8)) console.log(`  ${(s / 1024).toFixed(1).padStart(8)} KB  ${f}`);
try {
  const pack = execFileSync("git", ["count-objects", "-vH"], { encoding: "utf8" });
  console.log(
    pack
      .split("\n")
      .filter((l) => /size-pack|size:/.test(l))
      .join("\n"),
  );
} catch {
  /* not critical */
}
if (total > LIMIT_MB * 1024 * 1024) {
  console.error(`FAIL: tracked size exceeds ${LIMIT_MB} MB`);
  process.exit(1);
}
console.log("OK");
