import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = resolve(projectRoot, 'apps', 'worker', 'static');
const workerRoot = resolve(projectRoot, 'apps', 'worker');
const initialKnowledgeRoot = resolve(projectRoot, 'knowledge', 'initial');

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
  // Official LINE brand icon from https://www.line.me/ja/logo (LINE_Brand_icon.zip), used as-is.
  resolve(projectRoot, 'apps', 'widget', 'public', 'assets', 'LINE_Brand_icon.png'),
  join(staticRoot, 'assets', 'LINE_Brand_icon.png'),
);
await cp(
  resolve(projectRoot, 'output', 'pdf', 'orient-ai-chat-privacy-policy.pdf'),
  join(staticRoot, 'documents', 'orient-ai-chat-privacy-policy.pdf'),
);
await cp(
  initialKnowledgeRoot,
  join(staticRoot, 'knowledge'),
  { recursive: true },
);

const prefectureCities = new Map([
  ['大阪府', /^(?:大阪市|堺市|岸和田市|豊中市|池田市|吹田市|泉大津市|高槻市|貝塚市|守口市|枚方市|茨木市|八尾市|泉佐野市|富田林市|寝屋川市|河内長野市|松原市|大東市|和泉市|箕面市|柏原市|羽曳野市|門真市|摂津市|高石市|藤井寺市|東大阪市|泉南市|四條畷市|交野市|大阪狭山市|阪南市|三島郡|豊能郡|泉北郡|泉南郡|南河内郡|日置荘)/u],
  ['兵庫県', /^(?:神戸市|姫路市|尼崎市|明石市|西宮市|洲本市|芦屋市|伊丹市|相生市|豊岡市|加古川市|赤穂市|西脇市|宝塚市|三木市|高砂市|川西市|小野市|三田市|加西市|丹波篠山市|養父市|丹波市|南あわじ市|朝来市|淡路市|宍粟市|加東市|たつの市|川辺郡|多可郡|加古郡|神崎郡|揖保郡|赤穂郡|佐用郡|美方郡)/u],
  ['和歌山県', /^(?:和歌山市|海南市|橋本市|有田市|御坊市|田辺市|新宮市|紀の川市|岩出市|海草郡|伊都郡|有田郡|日高郡|西牟婁郡|東牟婁郡)/u],
  ['奈良県', /^(?:奈良市|大和高田市|大和郡山市|天理市|橿原市|桜井市|五條市|御所市|生駒市|香芝市|葛城市|宇陀市|山辺郡|生駒郡|磯城郡|宇陀郡|高市郡|北葛城郡|吉野郡)/u],
  ['京都府', /^(?:京都市|福知山市|舞鶴市|綾部市|宇治市|宮津市|亀岡市|城陽市|向日市|長岡京市|八幡市|京田辺市|京丹後市|南丹市|木津川市|乙訓郡|久世郡|綴喜郡|相楽郡|船井郡|与謝郡)/u],
]);

function inferPrefecture(address) {
  const normalized = address.replace(/\s+/gu, '');
  const explicit = normalized.match(/^(北海道|東京都|京都府|大阪府|.{2,3}県)/u)?.[1];
  if (explicit) return explicit;
  return [...prefectureCities].find(([, pattern]) => pattern.test(normalized))?.[0] || 'その他';
}

function extractPropertyAddress(markdown) {
  const lines = markdown.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() || '';
    const inline = line.match(/^[-*]\s*(?:住所|所在地)\s*[:：]\s*(.+)$/u)?.[1]?.trim();
    if (inline) return inline;
    if (line === '住所' || line === '所在地') {
      for (let offset = 1; offset <= 10; offset += 1) {
        const candidate = lines[index + offset]?.trim() || '';
        if (!candidate || candidate.startsWith('#') || /^(?:公式ページ|更新日)\s*:/u.test(candidate)) continue;
        if (candidate === '交通') break;
        return candidate;
      }
    }
  }
  return '';
}

const manifest = JSON.parse(await readFile(join(initialKnowledgeRoot, 'manifest.json'), 'utf8'));
const propertyFiles = manifest.files.filter((entry) => /^properties_for_(?:sale|rent)$/u.test(entry.category || ''));
const propertyDashboardIndex = await Promise.all(propertyFiles.map(async (entry) => {
  const markdown = await readFile(join(initialKnowledgeRoot, entry.file), 'utf8');
  const address = extractPropertyAddress(markdown);
  return {
    sourceUrl: entry.source_url,
    title: entry.title || entry.file.split('/').at(-1),
    address,
    prefecture: inferPrefecture(address),
    category: entry.category,
  };
}));
await writeFile(
  join(staticRoot, 'knowledge', 'property-dashboard-index.json'),
  `${JSON.stringify(propertyDashboardIndex)}\n`,
  'utf8',
);
