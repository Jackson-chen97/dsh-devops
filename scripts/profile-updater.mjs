// Idempotently add '@jacksonchen/dsh-devops' to the web profile's
// dsh.profile.bundles list (same mechanism as @deepseek-ai/dsh-base / dsh-web-app).
import { readFileSync, writeFileSync } from 'node:fs';

const pkgPath = 'C:/Users/T6003362/.dsh/profiles/web/package.json';
const name = '@jacksonchen/dsh-devops';

const j = JSON.parse(readFileSync(pkgPath, 'utf8'));
j.dsh ??= {};
j.dsh.profile ??= {};
if (!Array.isArray(j.dsh.profile.bundles)) j.dsh.profile.bundles = [];

if (!j.dsh.profile.bundles.includes(name)) {
  j.dsh.profile.bundles.push(name);
}
writeFileSync(pkgPath, JSON.stringify(j, null, 2) + '\n');
console.log('bundles ->', j.dsh.profile.bundles.join(', '));
