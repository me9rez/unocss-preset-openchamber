/**
 * 把 themes/*.json 编译成 src/generated.ts：
 *   - themeVars：每个主题一份 CSS 变量表（颜色 + 三级阴影）
 *   - colorTheme：所有主题共用的嵌套颜色映射，值一律是 var()，所以换主题只换变量
 * 不引入运行时依赖，产物是纯 TS 常量。
 *
 *   node scripts/gen-themes.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** 三级抬起：深色主题在亮环外再加一圈暗环，否则单一环在暗底上要么消失要么发光 */
const ELEVATION = {
  dark: {
    '--oc-lit': 'rgba(255,255,255,.07)',
    '--oc-elevation-button':
      'inset 0 1px 0 var(--oc-lit), 0 0 0 .5px var(--oc-edge), 0 0 0 1px rgba(0,0,0,.6), 0 1px 1.5px rgba(0,0,0,.45)',
    '--oc-elevation-raised':
      'inset 0 1px 0 var(--oc-lit), 0 0 0 .5px var(--oc-edge), 0 0 0 1px rgba(0,0,0,.6), 0 1px 2px -.5px rgba(0,0,0,.5), 0 4px 10px -2px rgba(0,0,0,.55)',
    '--oc-elevation-floating':
      'inset 0 1px 0 var(--oc-lit), 0 0 0 .5px var(--oc-edge), 0 0 0 1px rgba(0,0,0,.6), 0 1px 2px -.5px rgba(0,0,0,.5), 0 4px 10px -2px rgba(0,0,0,.55), 0 14px 28px -6px rgba(0,0,0,.6)',
  },
  light: {
    '--oc-lit': 'rgba(255,255,255,.9)',
    '--oc-elevation-button':
      'inset 0 1px 0 var(--oc-lit), 0 0 0 .5px rgba(0,0,0,.10), 0 1px 1.5px rgba(0,0,0,.08)',
    '--oc-elevation-raised':
      'inset 0 1px 0 var(--oc-lit), 0 0 0 .5px rgba(0,0,0,.10), 0 1px 2px -.5px rgba(0,0,0,.06), 0 4px 10px -2px rgba(0,0,0,.07)',
    '--oc-elevation-floating':
      'inset 0 1px 0 var(--oc-lit), 0 0 0 .5px rgba(0,0,0,.10), 0 1px 2px -.5px rgba(0,0,0,.08), 0 4px 10px -2px rgba(0,0,0,.11), 0 14px 28px -6px rgba(0,0,0,.12)',
  },
};

const files = readdirSync(join(root, 'themes')).filter((f) => f.endsWith('.json')).sort();
const themeVars = {};
const colorPaths = new Set();

for (const file of files) {
  const theme = JSON.parse(readFileSync(join(root, 'themes', file), 'utf8'));
  const id = theme.metadata.id;
  const vars = {};

  // 颜色：叶子路径 → --family-role
  const walk = (node, path) => {
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === 'object') {
        walk(value, [...path, key]);
        continue;
      }
      const name = [...path, key].map(kebab).join('-');
      vars[`--${name}`] = value;
      colorPaths.add(name);
    }
  };
  walk(theme.colors, []);

  // 布局用的中间变量：hairline 颜色取前景的 16%（深）/14%（浅），与上游一致
  const variant = theme.metadata.variant === 'light' ? 'light' : 'dark';
  vars['--oc-edge'] =
    variant === 'dark'
      ? 'color-mix(in srgb, var(--surface-foreground) 16%, transparent)'
      : 'color-mix(in srgb, var(--surface-foreground) 14%, transparent)';
  Object.assign(vars, ELEVATION[variant]);

  // 主色上的文字：深色主题取画布色，浅色主题取白
  vars['--primary-foreground'] = variant === 'light' ? '#ffffff' : theme.colors.surface.background;
  colorPaths.add('primary-foreground');

  // 控件底：浅色主题取画布色（比 elevated 浅），深色主题取 elevated —— 上游用 dark: 变体表达，
  // 这里落成一个变量，换主题即生效，不依赖媒体查询或 darkMode 配置
  vars['--oc-control-surface'] = variant === 'light' ? theme.colors.surface.background : theme.colors.surface.elevated;

  themeVars[id] = vars;
}

// 共用颜色映射：family → 扁平子键。
// 只保留一层嵌套，因为 'muted' 与 'muted-foreground' 这类前缀关系在深层嵌套里会撞车；
// base/tokens/highlights/edit 是上游的分组壳，压掉一层。
const GROUPS = new Set(['base', 'tokens', 'highlights', 'edit']);
const kebabKey = (segments) => segments.map(kebab).join('-');

const nested = {};
for (const file of files) {
  const theme = JSON.parse(readFileSync(join(root, 'themes', file), 'utf8'));
  for (const [family, value] of Object.entries(theme.colors)) {
    const bucket = (nested[family] ??= {});
    const walkFamily = (node, path) => {
      for (const [key, v] of Object.entries(node)) {
        if (v && typeof v === 'object' && !GROUPS.has(key)) {
          walkFamily(v, [...path, key]);
          continue;
        }
        if (v && typeof v === 'object') {
          walkFamily(v, path);
          continue;
        }
        bucket[kebabKey([...path, key])] = `var(--${kebabKey([family, ...path, key])})`;
      }
    };
    if (value && typeof value === 'object') walkFamily(value, []);
    else bucket.DEFAULT = `var(--${kebabKey([family])})`;
  }
}
if (nested.primary) {
  nested.primary.DEFAULT = 'var(--primary-base)';
  // 主色上的文字：上游主题 JSON 里没有这个键，由 gen 派生
  nested.primary.foreground = 'var(--primary-foreground)';
}
nested.background = 'var(--surface-background)';
nested.foreground = 'var(--surface-foreground)';
nested.muted = 'var(--surface-muted)';
nested['muted-foreground'] = 'var(--surface-muted-foreground)';
nested.border = 'var(--interactive-border)';

const ids = Object.keys(themeVars);
const out = `/* 由 scripts/gen-themes.mjs 生成，勿手改。源：themes/*.json（来自 openchamber，MIT） */
export const themeIds = ${JSON.stringify(ids)} as const;
export type ThemeId = (typeof themeIds)[number];

export const defaultTheme: ThemeId = ${JSON.stringify(ids.find((id) => id === 'openchamber-dark') ?? ids[0])};

export const themeVars: Record<ThemeId, Record<string, string>> = ${JSON.stringify(themeVars, null, 2)};

export const colorTheme = ${JSON.stringify(nested, null, 2)} as const;
`;
writeFileSync(join(root, 'src', 'generated.ts'), out, 'utf8');

const total = Object.values(themeVars).reduce((n, v) => n + Object.keys(v).length, 0);
console.log(`themes: ${ids.join(', ')}`);
console.log(`颜色变量 ${colorPaths.size} 个 × ${ids.length} 套 = ${total} 条；generated.ts ${out.length} 字节`);
