import plugin from './scripts/stylelint-k8k.mjs';
export default {
  plugins: [plugin],
  reportDisables: true,
  rules: {
    'k8k/token-values': true,
    'color-no-invalid-hex': true,
    'block-no-empty': true,
    'declaration-block-no-duplicate-properties': true,
  },
};
