import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = resolve(projectRoot, 'apps', 'worker', 'static');
const workerRoot = resolve(projectRoot, 'apps', 'worker');

if (relative(workerRoot, staticRoot).startsWith('..')) {
  throw new Error(`Refusing to replace assets outside the Worker directory: ${staticRoot}`);
}

await rm(staticRoot, { recursive: true, force: true });
await mkdir(join(staticRoot, 'admin'), { recursive: true });
await mkdir(join(staticRoot, 'widget'), { recursive: true });
await mkdir(join(staticRoot, 'assets'), { recursive: true });
await mkdir(join(staticRoot, 'documents'), { recursive: true });
await mkdir(join(staticRoot, 'knowledge'), { recursive: true });

await cp(resolve(projectRoot, 'apps', 'admin', 'dist'), join(staticRoot, 'admin'), { recursive: true });
await cp(resolve(projectRoot, 'apps', 'widget', 'dist'), join(staticRoot, 'widget'), { recursive: true });
await cp(
  resolve(projectRoot, 'apps', 'widget', 'public', 'assets', 'orinyan-states.png'),
  join(staticRoot, 'assets', 'orinyan-states.png'),
);
await cp(
  resolve(projectRoot, 'output', 'pdf', 'orient-ai-chat-privacy-policy.pdf'),
  join(staticRoot, 'documents', 'orient-ai-chat-privacy-policy.pdf'),
);
await cp(
  resolve(projectRoot, 'knowledge', 'initial'),
  join(staticRoot, 'knowledge'),
  { recursive: true },
);
