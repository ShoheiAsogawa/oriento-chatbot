import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const previewPublic = resolve(root, 'apps/preview/public');

await mkdir(resolve(previewPublic, 'widget'), { recursive: true });
await mkdir(resolve(previewPublic, 'assets'), { recursive: true });
await cp(resolve(root, 'apps/widget/dist/orient-chat.js'), resolve(previewPublic, 'widget/orient-chat.js'));
await cp(
  resolve(root, 'apps/widget/public/assets/orinyan-states.png'),
  resolve(previewPublic, 'assets/orinyan-states.png'),
);
await cp(
  resolve(root, 'apps/widget/public/assets/LINE_Brand_icon.png'),
  resolve(previewPublic, 'assets/LINE_Brand_icon.png'),
);
console.log(`preview assets -> ${previewPublic}`);
