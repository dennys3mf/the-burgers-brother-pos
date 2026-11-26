import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = new URL('../', import.meta.url);
const path = name => fileURLToPath(new URL(name, project));

execFileSync(process.execPath, [
  path('node_modules/tailwindcss/lib/cli.js'),
  '-c', 'tailwind.config.cjs',
  '-i', 'styles/tailwind.css',
  '-o', 'public/vendor/tailwind.css',
  '--minify'
], { cwd: fileURLToPath(project), stdio: 'inherit' });

const lucide = readFileSync(path('node_modules/lucide/dist/umd/lucide.min.js'), 'utf8');
writeFileSync(path('public/vendor/lucide.min.js'), lucide.replace(/\n?\/\/# sourceMappingURL=.*$/m, ''));
copyFileSync(path('node_modules/lucide/LICENSE'), path('public/vendor/lucide-LICENSE.txt'));
copyFileSync(path('node_modules/tailwindcss/LICENSE'), path('public/vendor/tailwind-LICENSE.txt'));
copyFileSync(path('node_modules/qrcode-generator/qrcode.js'), path('public/vendor/qrcode.js'));
