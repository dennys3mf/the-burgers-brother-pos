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
copyFileSync(path('node_modules/@phosphor-icons/core/LICENSE'), path('public/vendor/phosphor-LICENSE.txt'));

// Extract exact verified Phosphor Icons SVG definitions for the staff login screen (zero CDN / zero font FOUT).
const phosphorSpecs = [
  ['identification-badge-duotone', 'duotone/identification-badge-duotone.svg'],
  ['chef-hat-duotone', 'duotone/chef-hat-duotone.svg'],
  ['lock-simple', 'regular/lock-simple.svg'],
  ['eye', 'regular/eye.svg'],
  ['eye-slash', 'regular/eye-slash.svg'],
  ['caret-down', 'regular/caret-down.svg'],
  ['sign-in', 'regular/sign-in.svg'],
  ['arrow-left', 'regular/arrow-left.svg'],
  ['warning-circle', 'regular/warning-circle.svg'],
  ['spinner-gap', 'regular/spinner-gap.svg']
];
const phosphorEntries = phosphorSpecs.map(([name, rel]) => {
  const raw = readFileSync(path(`node_modules/@phosphor-icons/core/assets/${rel}`), 'utf8').trim();
  const inner = raw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return `  ${JSON.stringify(name)}: ${JSON.stringify(inner)}`;
});
writeFileSync(
  path('public/personal/phosphor-icons.js'),
  `// Auto-generated from @phosphor-icons/core via scripts/build-assets.mjs. Do not edit manually.\n`
  + `export const PHOSPHOR_ICONS = Object.freeze({\n${phosphorEntries.join(',\n')}\n});\n\n`
  + `export function phosphorIconSvg(name, { size = 20, className = '' } = {}) {\n`
  + `  const inner = PHOSPHOR_ICONS[name];\n`
  + `  if (!inner) return '';\n`
  + `  const cls = className ? \` class="\${className}"\` : '';\n`
  + `  return \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="\${size}" height="\${size}" fill="currentColor" aria-hidden="true" focusable="false"\${cls}>\${inner}</svg>\`;\n`
  + `}\n`
);
