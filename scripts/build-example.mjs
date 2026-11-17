/**
 * 用真实 UnoCSS 生成器编译 example/index.html，产出 example/uno.css。
 *   node scripts/build-example.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGenerator } from 'unocss';
import { presetOpenChamber } from '../dist/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'example', 'index.html'), 'utf8');

const uno = await createGenerator({ presets: [presetOpenChamber()] });
const { css, matched } = await uno.generate(html, { preflights: true });

writeFileSync(join(root, 'example', 'uno.css'), css, 'utf8');
const layers = [...css.matchAll(/\/\* layer: (\w+) \*\//g)].map((m) => m[1]);
console.log(`matched ${matched.size} utilities → example/uno.css ${css.length} 字节`);
console.log(`layers: ${layers.join(', ')}`);
