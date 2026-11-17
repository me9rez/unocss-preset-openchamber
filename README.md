# unocss-preset-openchamber

[OpenChamber](https://github.com/openchamber/openchamber) 设计规范的 UnoCSS 预设：语义色板、三级抬起、
一套**从源码量出来**的组件尺寸，4 套主题开箱可切。规范全文在
[openchamber-design-system](https://github.com/me9rez/openchamber-design-system)。

- 颜色 / 圆角 / 字号 / 阴影全部走 CSS 变量，换 `data-theme` 就换整套，**不需要重编译**
- 自带 `presetWind4`，只装这一个预设就能用
- 组件尺寸来自上游 cva 变体，不是目测：按钮 32/28/24/36、触发器 28、分段项 28、步进器 32（± 各 36）
- 双格式（ESM + CJS）+ 类型，Node ≥ 18、UnoCSS ≥ 66（主题值走 wind4 的变量机制）

## 装

```bash
npm i -D unocss unocss-preset-openchamber
```

## 用

```ts
// uno.config.ts
import { defineConfig } from 'unocss';
import { presetOpenChamber } from 'unocss-preset-openchamber';

export default defineConfig({
  presets: [presetOpenChamber()], // 已经内置 presetWind4
});
```

> 主题值挂在一个排在 `presetWind4` 之后的内部预设上，所以它总是盖掉 wind4 自带的 `radius` / `shadow` 档位；
> 你自己的预设若也要改这些键，把它放在本预设**之后**。

换主题只要改根元素：

```html
<html data-theme="vercel-dark">   <!-- openchamber-dark（默认） / openchamber-light / vercel-dark / vercel-light -->
```

### 选项

```ts
presetOpenChamber({
  themes: ['openchamber-dark', 'vercel-light'], // 只生成这两套，默认全部 4 套
  defaultTheme: 'vercel-light',                 // 进 :root 的那套，默认 openchamber-dark
  base: false,                                  // 不注入 body 的底色/字色/字体
});
```

## 有什么

**语义色**（每个都是 CSS 变量，深浅主题各一套）：

| 家族 | 工具类示例 |
|---|---|
| `surface` | `bg-surface-background` `text-surface-foreground` `bg-surface-elevated` `text-muted-foreground` |
| `primary` | `bg-primary` `text-primary-foreground` `hover:bg-primary-hover` |
| `interactive` | `border-interactive-border` `hover:bg-interactive-hover` `bg-interactive-selection` |
| `status` | `text-status-error` `bg-status-warning-background` `border-status-info-border` |
| `syntax` / `markdown` / `tools` / `chat` / `pr` / `diff` | `text-syntax-keyword` `bg-markdown-inline-code-background` … |

简写：`bg-background` `text-foreground` `bg-muted` `text-muted-foreground` `border-border`。

**档位**：

| 键 | 值 |
|---|---|
| `rounded-sm / md / (default) / lg / xl` | 4 / 7 / 9 / 9 / 12px |
| `text-ui-label / meta / micro / header / section / markdown / code / page-title` | 13.5 / 12.5 / 12 / 14 / 15 / 14 / 12 / 17px，带行高 |
| `shadow-button / raised / floating` | 三级抬起（浅/深主题层叠不同，走变量） |
| `font-sans` / `font-mono` | Inter / Geist Mono，中文回退雅黑 |

**组件 shortcut / rule**：

| 类 | 规格 |
|---|---|
| `oc-btn` + `oc-btn-primary / -default / -outline / -ghost / -destructive` | 32px、r7、13.5px/500 |
| `oc-btn-sm / -xs / -lg / -icon` | 28 / 24(r5) / 36 / 32×32 |
| `oc-trigger` | 28px、r7、横向 10px，浅色画布底、深色 elevated 底 |
| `oc-field` | 32px、r7、elevated 底 + hairline，`[aria-invalid]` 转红 |
| `oc-seg` + `oc-seg-item` / `oc-seg-item-active` | 轨道 r9 + fg 4% 凹槽，选中项抬回控件底 |
| `oc-stepper` + `-btn` / `-value` | 32px、r9、± 各 36px、数值区 `calc(5.75rem+5ch)` |
| `oc-tile` / `oc-tile-inset` / `oc-tile-hover` | 色阶 4% / 6% / hover 7%（深浅主题通用） |
| `oc-raised` / `oc-recessed` / `oc-glass-popover` / `oc-panel-edge` | 三条多属性规则 |
| `oc-label` / `oc-section-title` / `oc-group-title` / `oc-meta` | 设置页文字档 |

## 三条设计原则

1. **安静优先** —— 静止的屏幕只显示要读的内容和需要用户的东西，其余等 hover / 菜单 / 快捷键。
2. **控件立起，布局平躺** —— 深度只有三级；卡片和分组没有边框，只靠色阶区分。
3. **颜色只表示状态** —— 蓝=工作中、绿=完成、黄=等你、红=错误；非状态强调一律用 muted 或正文色。

## 验

```bash
npm test          # 用真实 UnoCSS 生成器断言 19 项（主题变量、色板映射、五档按钮、触发器、步进器…）
npm run example    # 编译 example/index.html → example/uno.css，打开看实物
```

## 已知边界

- **深色下的"选中项"会变平。** 选中项按上游规则回到 `surface.elevated`；`vercel-dark` 的 elevated（`#070707`）
  几乎贴着画布（`#000`），此时只能靠那圈 hairline 分辨。这是调色板的性质，不是组件写错了。
- **主题值是 `data-theme` 属性驱动**，不是 `prefers-color-scheme`。要跟随系统就自己用 JS 设属性。
- **wind4 会把主题值编译成 CSS 变量，而且按需输出。** `rounded-md` 是 `border-radius:var(--radius-md)`，值在 theme 层；
  如果你在自己 CSS 里直接写 `var(--radius-md)` 却在模板里没用过 `rounded-md`，这个变量不会出现——用工具类，或自己补一份变量。
- **自带 `presetWind4`（含它的 reset / `@property` 层）**，不需要再挂 `presetWind3`；要 Tailwind 那套额外工具就自己加。

## 来源与许可

MIT。主题数据与组件尺寸提取自 openchamber（MIT），详见 [NOTICE.md](NOTICE.md)；非官方产物。
