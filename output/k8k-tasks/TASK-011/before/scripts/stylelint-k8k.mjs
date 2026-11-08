import stylelint from 'stylelint';
import valueParser from 'postcss-value-parser';
import { parse } from 'culori';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

export const tokenFile = fileURLToPath(new URL('../packages/ui/src/tokens.css', import.meta.url));
export const ruleName = 'k8k/token-values';
const definitions = [...readFileSync(tokenFile, 'utf8').matchAll(/(--[\w-]+):\s*([^;]+);/g)];
const fontTokens = new Set(
  definitions.filter((m) => m[1].startsWith('--k8k-font-')).map((m) => m[1]),
);
const decorative = new Set(['--k8k-accent']);
for (let i = 0; i < definitions.length; i++)
  for (const match of definitions)
    if ([...decorative].some((name) => match[2].includes(name))) decorative.add(match[1]);
const globals = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);
const contextual = new Set([...globals, 'currentcolor', 'transparent', 'none']);
const colorFunctions =
  /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|device-cmyk|light-dark)$/i;

export function violations(decl, filename) {
  if (path.resolve(filename) === tokenFile && decl.prop.startsWith('--')) return [];
  const found = new Set();
  const prop = decl.prop.toLowerCase();
  valueParser(decl.value).walk((node, index, nodes) => {
    if (node.type === 'function') {
      if (node.value.toLowerCase() === 'url') return false;
      if (colorFunctions.test(node.value)) found.add('raw-color');
      // Walk var fallbacks and shadow/gradient arguments; alpha is not an exemption.
    }
    if (node.type !== 'word') return;
    const word = node.value.toLowerCase();
    if (decorative.has(word)) found.add('decorative-accent-in-ui');
    if (prop === 'font-size' && word.startsWith('--') && !fontTokens.has(word))
      found.add('noncanonical-font-token');
    if (prop === 'font' && word.startsWith('--') && !fontTokens.has(word) && word !== '--k8k-font')
      found.add('noncanonical-font-token');
    if (
      !word.startsWith('--') &&
      !contextual.has(word) &&
      (/^#/.test(word) || (/^[a-z]+$/.test(word) && parse(word)))
    )
      found.add('raw-color');
    if (prop === 'font-size' && !word.startsWith('--') && !globals.has(word))
      found.add('raw-font-size');
    if (prop === 'font' && !word.startsWith('--')) {
      const previous = nodes
        .slice(0, index)
        .findLast((n) => !['space', 'comment'].includes(n.type));
      const lineHeight = previous?.type === 'div' && previous.value === '/';
      if (
        !lineHeight &&
        (/^-?(?:\d*\.)?\d+(?:px|rem|em|%|vw|vh|vmin|vmax|pt|pc|ex|ch|in|cm|mm|q)$/.test(word) ||
          /^(?:0|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger)$/.test(
            word,
          ))
      )
        found.add('raw-font-shorthand');
    }
  });
  return [...found];
}

function context(decl) {
  const parts = [];
  for (let node = decl.parent; node?.type !== 'root'; node = node.parent) {
    if (!node) break;
    parts.unshift(node.type === 'rule' ? node.selector : `@${node.name} ${node.params}`);
  }
  return parts;
}
export function declarationIdentity(decl, occurrence) {
  const identity = { context: context(decl), property: decl.prop, value: decl.value, occurrence };
  return {
    ...identity,
    sha256: createHash('sha256').update(JSON.stringify(identity)).digest('hex'),
  };
}
const rule = (enabled) => (root, result) => {
  if (!stylelint.utils.validateOptions(result, ruleName, { actual: enabled, possible: [true] }))
    return;
  const counts = new Map();
  root.walkDecls((decl) => {
    const base = JSON.stringify(declarationIdentity(decl, 0));
    const occurrence = (counts.get(base) ?? 0) + 1;
    counts.set(base, occurrence);
    for (const reason of violations(decl, root.source.input.file)) {
      const identity = declarationIdentity(decl, occurrence);
      stylelint.utils.report({
        result,
        ruleName,
        node: decl,
        message: `${reason}: ${JSON.stringify(identity)}`,
        word: decl.value,
      });
    }
  });
};
rule.ruleName = ruleName;
rule.messages = stylelint.utils.ruleMessages(ruleName, { rejected: (value) => value });
export default stylelint.createPlugin(ruleName, rule);
