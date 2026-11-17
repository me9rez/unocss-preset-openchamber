/**
 * 用真实的 UnoCSS 生成器跑预设。wind4 把主题值摊成 CSS 变量再被工具类引用，
 * 所以断言分两处：变量定义（theme 层）+ 工具类引用（default 层）。
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGenerator } from 'unocss';
import { presetOpenChamber, themeIds, themeVars } from '../dist/index.js';

const squash = (css) => css.replace(/\s+/g, ' ');
const run = async (html, options = {}, genOpts = { preflights: true }) => {
  const uno = await createGenerator({ presets: [presetOpenChamber(options)] });
  return squash((await uno.generate(html, genOpts)).css);
};
const gen = (html, options) => run(html, options, { preflights: false });
const has = (css, a, b) => css.includes(a) || css.includes(b);

test('四套主题的变量都注入了 preflight', async () => {
  const css = await run('');
  for (const id of themeIds) {
    assert.ok(css.includes(`[data-theme="${id}"]{`) || css.startsWith(':root{'), `缺 ${id}`);
    for (const varName of ['--surface-background', '--surface-elevated', '--oc-elevation-raised']) {
      assert.ok(themeVars[id][varName], `${id} 缺 ${varName}`);
    }
  }
  assert.ok(css.includes('--surface-background:#120f0e'), 'openchamber-dark 的底色不对');
  assert.ok(css.includes('--surface-background:#000000'), 'vercel-dark 的底色不对');
  assert.equal(Object.keys(themeVars).length, 4);
});

// 取包含某变量的那个 :root 块（wind4 自己也发 :root{--spacing…}，不能只找第一个）
const rootBlockOf = (css, needle) => {
  const at = css.indexOf(needle);
  if (at < 0) return '';
  const open = css.lastIndexOf(':root{', at);
  return open < 0 ? '' : css.slice(open, css.indexOf('}', at) + 1);
};

test('默认主题进 :root，可换', async () => {
  const css = await run('');
  assert.ok(rootBlockOf(css, '--surface-background:#120f0e').includes('--surface-background:#120f0e'), '默认应是 openchamber-dark');

  const light = await run('', { defaultTheme: 'vercel-light' });
  const lightRoot = rootBlockOf(light, '--surface-background:#ffffff');
  assert.ok(lightRoot.length > 0, 'defaultTheme 没生效');
  assert.ok(!lightRoot.includes('#120f0e'), ':root 里混进了默认主题');
});

test('只生成指定的主题', async () => {
  const css = await run('', { themes: ['vercel-dark'] });
  assert.ok(!css.includes('[data-theme="openchamber-dark"]'), '不该出现未选的主题');
  assert.ok(css.includes('--surface-background:#000000'));
});

test('语义色 → 工具类走 CSS 变量', async () => {
  const css = await gen('bg-surface-elevated text-surface-foreground bg-primary border-interactive-border');
  assert.ok(css.includes('var(--surface-elevated)'), css);
  assert.ok(css.includes('var(--surface-foreground)'));
  assert.ok(css.includes('var(--primary-base)'), 'bg-primary 应映射到 --primary-base');
  assert.ok(css.includes('var(--interactive-border)'));
});

test('圆角档位来自规范：4 / 7 / 9 / 12', async () => {
  const css = await run('rounded-sm rounded-md rounded rounded-lg rounded-xl');
  // wind4 把档位摊成变量，值在 theme 层（只输出用到的那些）
  for (const [k, px] of [['sm', '4px'], ['md', '7px'], ['lg', '9px'], ['xl', '12px']]) {
    assert.ok(has(css, `--radius-${k}:${px}`, `--radius-${k}: ${px}`), `--radius-${k} 应为 ${px}`);
    assert.ok(css.includes(`border-radius:var(--radius-${k})`), `rounded-${k} 没引用变量`);
  }
});

test('字号档位带行高', async () => {
  const css = await run('text-ui-label text-meta text-micro');
  assert.ok(has(css, '--text-ui-label-fontSize:13.5px', '--text-ui-label-fontSize: 13.5px'), css);
  assert.ok(has(css, '--text-ui-label-lineHeight:1.2', '--text-ui-label-lineHeight: 1.2'));
  assert.ok(has(css, '--text-meta-fontSize:12.5px', '--text-meta-fontSize: 12.5px'));
  assert.ok(has(css, '--text-micro-fontSize:12px', '--text-micro-fontSize: 12px'));
});

test('三级抬起 → shadow 工具类', async () => {
  const css = await gen('shadow-button shadow-raised shadow-floating');
  for (const k of ['button', 'raised', 'floating']) {
    assert.ok(css.includes(`--un-shadow:var(--oc-elevation-${k})`), `${k} 缺`);
  }
});

test('按钮：32 高 / r7 / 主色 + 主色上的文字', async () => {
  const css = await gen('oc-btn-primary');
  assert.ok(css.includes('height:calc(var(--spacing) * 8)'), 'h-8 应为 8 个 spacing 单位'); // 0.25rem × 8 = 32px
  assert.ok(css.includes('border-radius:var(--radius-md)'), 'r7 应走 --radius-md');
  assert.ok(css.includes('var(--primary-base)'));
  assert.ok(css.includes('var(--primary-foreground)'));
  assert.ok(css.includes('gap:calc(var(--spacing) * 2)'));
});

test('尺寸档：sm 28 / xs 24+r5+12px / lg 36', async () => {
  const sm = await gen('oc-btn-default oc-btn-sm');
  assert.ok(sm.includes('height:calc(var(--spacing) * 7)'), 'sm 应为 28px');
  const xs = await gen('oc-btn-xs');
  assert.ok(xs.includes('height:calc(var(--spacing) * 6)'), 'xs 应为 24px');
  assert.ok(/border-radius:5px/.test(xs), xs.match(/border-radius[^;]*/)?.[0] ?? 'no radius');
  const lg = await gen('oc-btn-lg');
  assert.ok(lg.includes('height:calc(var(--spacing) * 9)'), 'lg 应为 36px');
});

test('触发器 28 / r7，控件底走主题变量', async () => {
  const css = await gen('oc-trigger');
  assert.ok(css.includes('height:calc(var(--spacing) * 7)'));
  assert.ok(css.includes('border-radius:var(--radius-md)'));
  assert.ok(css.includes('var(--oc-control-surface)'), '不该依赖 dark: 变体');
});

test('输入框 32 / elevated 底 / raised 阴影', async () => {
  const css = await gen('oc-field');
  assert.ok(css.includes('height:calc(var(--spacing) * 8)'));
  assert.ok(css.includes('var(--surface-elevated)'));
  assert.ok(css.includes('--un-shadow:var(--oc-elevation-raised)'));
});

test('分段选择：轨道 fg 4% 凹槽 + 选中项抬回控件底', async () => {
  const track = await gen('oc-seg');
  assert.ok(track.includes('color-mix(in srgb,var(--surface-foreground) 4%,transparent)'), track);
  assert.ok(track.includes('inset 0 1px 2px rgba(0,0,0,.16)'), '凹槽应有内阴影');
  const active = await gen('oc-seg-item-active');
  assert.ok(active.includes('var(--oc-control-surface)'));
  assert.ok(active.includes('--un-shadow:var(--oc-elevation-button)'));
});

test('步进器 32 / r9 / ± 36px / 数值区最小宽', async () => {
  const css = await run('oc-stepper oc-stepper-btn oc-stepper-value');
  assert.ok(css.includes('height:calc(var(--spacing) * 8)'));
  assert.ok(has(css, '--radius-lg:9px', '--radius-lg: 9px'), '轨道应为 r9');
  assert.ok(css.includes('width:calc(var(--spacing) * 9)'), '± 应为 36px');
  assert.ok(/min-width:calc\(5\.75rem \+ 5ch\)|min-width:calc\(5\.75rem\+5ch\)/.test(css), css);
});

test('色阶工具：tile / tile-inset', async () => {
  const css = await gen('oc-tile oc-tile-inset');
  assert.ok(css.includes('color-mix(in srgb,var(--surface-foreground) 4%,transparent)'));
  assert.ok(css.includes('color-mix(in srgb,var(--surface-foreground) 6%,transparent)'));
});

test('玻璃浮层：模糊 + floating 阴影 + 12px 圆角', async () => {
  const css = await gen('oc-glass-popover');
  assert.ok(css.includes('backdrop-filter:blur(40px)'));
  assert.ok(css.includes('box-shadow:var(--oc-elevation-floating)'));
  assert.ok(css.includes('border-radius:12px'));
});

test('字体栈：Inter + Geist Mono，中文回退雅黑', async () => {
  const css = await run('font-sans font-mono');
  assert.ok(css.includes('Inter'), css);
  assert.ok(css.includes('Geist Mono'));
  assert.ok(css.includes('Microsoft YaHei UI'));
});

test('base 带边界盒，控件高度才等于名义高度', async () => {
  const css = await run('');
  assert.ok(css.includes('box-sizing:border-box'), css.slice(0, 200));
});

test('base 可关掉', async () => {
  const css = await run('', { base: false });
  assert.ok(!css.includes('background:var(--surface-background)'), 'base:false 仍注入了 body 样式');
});

test('自引用 shortcut 能递归展开', async () => {
  const css = await gen('oc-btn-ghost');
  // oc-btn 提供的基础属性 + ghost 自己的颜色
  assert.ok(css.includes('display:inline-flex'));
  assert.ok(css.includes('background-color:transparent'));
});
