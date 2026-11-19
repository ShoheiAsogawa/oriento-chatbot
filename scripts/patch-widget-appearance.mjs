import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, 'apps/widget/vendor/orient-chat.live.js');
const outputPath = resolve(root, 'apps/widget/dist/orient-chat.js');

// 塗りは明るい黄色。白文字は #ffcc00 とのコントラストが 1.51:1 なので、
// 黄色の上の文字は既存の墨色 #1f1f2c（10.76:1）にする。
// 白や薄い地の上の文字・アイコンは #8a6200（白との 5.49:1）。
// ホバーの塗りは #e6b000（墨色との 8.19:1）。
const primary = '#ffcc00';
const strong = '#e6b000';
const textGold = '#8a6200';
const onFill = '#1f1f2c';
const soft = '#fffbeb';
const wash = '#fff6d6';
const tint = '#ffefb3';
const hover = '#ffe58a';
const line = '#f3dc8a';
const lineStrong = '#e8cc66';
const accentLine = '#e0bc45';

const launcherCopy = {
  'aria-label="オリにゃんAIに聞くにゃ！"': 'aria-label="物件探しのことならオリにゃんAIに聞くにゃ！"',
  '<span class="launcher-label">オリにゃんAIに聞くにゃ！</span>': '<span class="launcher-label">物件探しのことなら<br class="launcher-break">オリにゃんAIに聞くにゃ！</span>',
  'launcher:"オリにゃんAIに聞くにゃ！"': 'launcher:"物件探しのことなら\\nオリにゃんAIに聞くにゃ！"',
  'launcher:"Ask Orinyan!"': 'launcher:"Looking for a home?\\nAsk Orinyan!"',
  'launcher:"问问奥利喵！"': 'launcher:"找房的话，\\n问问奥利喵！"',
  'launcher:"오리냥에게 물어봐!"': 'launcher:"집 찾기라면\\n오리냥에게 물어봐!"',
};

const mobileStart = ':host(:not([open])) {\n      bottom: 0;\n      width: 268px;';
const mobileEnd = '\n    .panel-header { min-height: 52px;';
const mobileReplacement = `:host(:not([open])) {
      bottom: 0;
      width: min(328px, 100vw);
      height: calc(136px + var(--orient-offset-bottom));
      overflow: hidden;
      pointer-events: none;
      z-index: 9999;
    }
    :host([open]) {
      width: auto;
      height: auto;
      right: 8px;
      bottom: calc(var(--orient-offset-bottom) + var(--orient-gutter-y));
      overflow: visible;
      pointer-events: auto;
      z-index: 2147483000;
    }
    :host([open]) .root { height: auto; overflow: visible; }
    .root { width: 100%; height: 100%; overflow: hidden; }
    .launcher-dock {
      width: min(328px, 100vw);
      height: 100%;
      overflow: hidden;
      pointer-events: none;
    }
    .launcher {
      top: 0;
      right: 0;
      left: 0;
      bottom: var(--orient-offset-bottom);
      width: auto;
      height: auto;
      pointer-events: auto;
    }
    .launcher-scene, .launcher-ring-clip { overflow: hidden; }
    .launcher-ring-clip { inset: 0; }
    .launcher-ring {
      width: 270px;
      height: 270px;
      right: -135px;
      bottom: calc(var(--orient-offset-bottom) - 135px);
      border: 3px solid #fff;
      box-shadow: none;
    }
    .launcher-character {
      width: 130px;
      height: 130px;
      right: -2px;
      bottom: calc(var(--orient-offset-bottom) - 4px);
      animation: launcher-peek-mobile 3.6s cubic-bezier(.45,0,.25,1) infinite;
    }
    .launcher-label {
      right: 118px;
      bottom: calc(var(--orient-offset-bottom) + 8px);
      max-width: 16em;
      padding: 8px 14px;
      font-size: 14px;
      font-weight: 800;
      line-height: 1.35;
      white-space: normal;
      text-align: left;
      display: inline-block;
      min-height: 0;
    }
    .launcher-break { display: block; }
    .launcher-label::after {
      right: -10px;
      top: 50%;
      bottom: auto;
      border-top-width: 8px;
      border-bottom-width: 8px;
      border-left-width: 12px;
      transform: translateY(-50%);
    }
    @keyframes launcher-peek-mobile {
      0%,100% { transform: translateY(1px) rotate(-1deg); }
      42% { transform: translateY(-3px) rotate(.5deg); }
      62% { transform: translateY(-1px) rotate(-.3deg); }
    }
`;

function replaceExact(source, from, to, expected) {
  const count = source.split(from).length - 1;
  if (count !== expected) {
    throw new Error(`「${from}」は ${expected} 件のはずが ${count} 件でした`);
  }
  return source.split(from).join(to);
}

let source = await readFile(sourcePath, 'utf8');

source = replaceExact(
  source,
  'applyConfiguration(){const e={"--orient-primary":this.getAttribute("primary-color"),"--orient-ink":this.getAttribute("ink-color")',
  'applyConfiguration(){const rawPrimary=this.getAttribute("primary-color");const primaryColor=/^#(?:ff680b|fd680a|b64d0c|99410a)$/i.test(rawPrimary||"")?null:rawPrimary;const e={"--orient-primary":primaryColor,"--orient-ink":this.getAttribute("ink-color")',
  1,
);

const onYellow = [
  ['padding: 13px 15px;\n    color: #fff;\n    background: var(--orient-primary);', `padding: 13px 15px;\n    color: ${onFill};\n    background: var(--orient-primary);`, 1],
  ['border-radius: 0;\n    color: #fff;\n    background: #ff680b;', `border-radius: 0;\n    color: ${onFill};\n    background: ${primary};`, 1],
  ['border-radius: 10px;\n    color: #fff;\n    background: #ff680b;', `border-radius: 10px;\n    color: ${onFill};\n    background: ${primary};`, 2],
  ['.user .bubble { color: #fff; background: #ff680b;', `.user .bubble { color: ${onFill}; background: ${primary};`, 1],
  ['border-radius: 999px; color: #fff; background: #ff680b;', `border-radius: 999px; color: ${onFill}; background: ${primary};`, 1],
  ['color: #fff;\n    background: #f25a00;', `color: ${onFill};\n    background: ${strong};`, 3],
  ['color: #fff; background: #f25a00;', `color: ${onFill}; background: ${strong};`, 1],
  ['.lang-menu button[aria-selected="true"] { color: #fff; background: var(--orient-primary); }', `.lang-menu button[aria-selected="true"] { color: ${onFill}; background: var(--orient-primary); }`, 1],
  ['.oc-cal-day[data-selected="true"] { color: #fff; background: var(--orient-primary); }', `.oc-cal-day[data-selected="true"] { color: ${onFill}; background: var(--orient-primary); }`, 1],
  ['border-radius: 10px;\n    color: #fff;\n    background: var(--orient-primary);', `border-radius: 10px;\n    color: ${onFill};\n    background: var(--orient-primary);`, 1],
  ['.lang-button { min-width: 36px; height: 32px; padding: 0 8px; border: 1px solid rgba(255,255,255,.5); border-radius: 999px; color: #fff; background: rgba(255,255,255,.16);', `.lang-button { min-width: 36px; height: 32px; padding: 0 8px; border: 1px solid rgba(31,31,44,.35); border-radius: 999px; color: ${onFill}; background: rgba(31,31,44,.06);`, 1],
  ['.lang-button:hover, .lang-button:focus-visible { background: rgba(255,255,255,.28); outline: none; }', '.lang-button:hover, .lang-button:focus-visible { background: rgba(31,31,44,.12); outline: none; }', 1],
  ['.icon-button { width: 40px; height: 40px; display: grid; place-items: center; border: 0; border-radius: 10px; color: #fff; background: transparent; cursor: pointer; }', `.icon-button { width: 40px; height: 40px; display: grid; place-items: center; border: 0; border-radius: 10px; color: ${onFill}; background: transparent; cursor: pointer; }`, 1],
  ['.icon-button:hover, .icon-button:focus-visible { background: rgba(255,255,255,.18); outline: none; }', '.icon-button:hover, .icon-button:focus-visible { background: rgba(31,31,44,.1); outline: none; }', 1],
  ['background: rgba(255,255,255,.22);', 'background: rgba(31,31,44,.12);', 2],
  ['.campaign-late-kicker {\n    color: #ff680b;', `.campaign-late-kicker {\n    color: ${textGold};`, 1],
  ['#c44a00', textGold, 2],
  ['--orient-primary-strong: #fd680a;', `--orient-primary-strong: ${textGold};`, 1],
  ['.send { width: 54px; min-width: 54px; max-width: 54px; height: 54px; min-height: 54px; max-height: 54px; display: grid; place-items: center; align-self: end; padding: 0; border: 0; border-radius: 12px; color: var(--orient-primary);', '.send { width: 54px; min-width: 54px; max-width: 54px; height: 54px; min-height: 54px; max-height: 54px; display: grid; place-items: center; align-self: end; padding: 0; border: 0; border-radius: 12px; color: var(--orient-primary-strong);', 1],
  ['.oc-cal-day[data-selected="true"]:focus-visible:not(:disabled) { background: var(--orient-primary-strong); }', `.oc-cal-day[data-selected="true"]:focus-visible:not(:disabled) { background: ${strong}; }`, 1],
  ['.oc-cal-submit:focus-visible { background: var(--orient-primary-strong);', `.oc-cal-submit:focus-visible { background: ${strong};`, 1],
  ['.oc-cal-day[data-selected="true"]:hover:not(:disabled) { background: var(--orient-primary-strong); }', `.oc-cal-day[data-selected="true"]:hover:not(:disabled) { background: ${strong}; }`, 1],
  ['.oc-cal-submit:hover { background: var(--orient-primary-strong); }', `.oc-cal-submit:hover { background: ${strong}; }`, 1],
  ['#fff8f1', '#fff8dc', 1],
  ['#ffe9d4', '#ffe9a0', 1],
  ['#ffd2b5', '#f3dc8a', 1],
  ['#6b2800', onFill, 2],
  ['rgba(180, 62, 0', 'rgba(138, 98, 0', 1],
];

for (const [from, to, expected] of onYellow) {
  source = replaceExact(source, from, to, expected);
}

const colorSwaps = [
  ['#ff680b', primary, 1],
  ['#ff9d62', accentLine, 1],
  ['#ffd8bf', line, 1],
  ['#ffd8c2', line, 1],
  ['#ffc49f', lineStrong, 2],
  ['#ffb98d', lineStrong, 1],
  ['#ffede2', hover, 4],
  ['#fff3eb', tint, 1],
  ['#fff1e8', hover, 1],
  ['#fff5ef', wash, 4],
  ['#fff7f2', wash, 3],
  ['#fff6f0', wash, 1],
  ['#fffaf7', soft, 3],
  ['rgba(255, 104, 11', 'rgba(255, 204, 0', 4],
  ['rgba(255,104,11', 'rgba(255,204,0', 16],
];

for (const [from, to, expected] of colorSwaps) {
  source = replaceExact(source, from, to, expected);
}

for (const [from, to] of Object.entries(launcherCopy)) {
  source = replaceExact(source, from, to, 1);
}
source = replaceExact(
  source,
  'h&&(h.textContent=e("launcher"));this.root.querySelector(".launcher")?.setAttribute("aria-label",e("launcher"))',
  'h&&(h.innerHTML=e("launcher").split("\\n").join("<br class=\\"launcher-break\\">"));this.root.querySelector(".launcher")?.setAttribute("aria-label",e("launcher").replace(/\\n/g,""))',
  1,
);
source = replaceExact(
  source,
  '.launcher-label::after {\n    content: "";',
  '.launcher-break { display: none; }\n  .launcher-label::after {\n    content: "";',
  1,
);

source = replaceExact(
  source,
  'bottom: var(--orient-offset-bottom);\n    width: 312px;\n    height: 148px;',
  'bottom: var(--orient-offset-bottom);\n    width: 420px;\n    height: 148px;',
  1,
);
source = replaceExact(
  source,
  '.launcher-dock { width: 312px; height: 148px;',
  '.launcher-dock { width: 420px; height: 148px;',
  1,
);

const mobileAt = source.indexOf(mobileStart);
const mobileStop = source.indexOf(mobileEnd, mobileAt);
if (mobileAt < 0 || mobileStop < 0) {
  throw new Error('スマホ用ランチャーのCSSが見つかりません');
}
source = `${source.slice(0, mobileAt)}${mobileReplacement}${source.slice(mobileStop)}`;

const required = [
  primary,
  strong,
  textGold,
  '物件探しのことなら\\nオリにゃんAIに聞くにゃ！',
  'Looking for a home?\\nAsk Orinyan!',
  '找房的话，\\n问问奥利喵！',
  '집 찾기라면\\n오리냥에게 물어봐!',
  'launcher-break',
  'width: 130px',
  'width: 270px',
  'width: 420px',
  'font-size: 14px',
];
for (const value of required) {
  if (!source.includes(value)) throw new Error(`パッチ結果に ${value} がありません`);
}
if (source.includes('#ff680b') || source.includes('オリにゃんAIに聞くにゃ！') && !source.includes('物件探しのことなら')) {
  throw new Error('古いオレンジまたは古い呼び出し文言が残っています');
}
if (source.includes('launcher:"Ask Orinyan!"') || source.includes('launcher:"问问奥利喵！"') || source.includes('launcher:"오리냥에게 물어봐!"')) {
  throw new Error('他言語の古い呼び出し文言が残っています');
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, source);
console.log(`patched widget -> ${outputPath}`);
