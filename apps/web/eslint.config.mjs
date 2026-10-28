import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import root from '../../eslint.config.mjs';

const config = [
  ...root,
  ...nextCoreWebVitals,
  {
    files: ['public/speaking-recorder.js'],
    // The TS rule crashes on native AudioWorklet JavaScript; all other rules still run.
    rules: { '@typescript-eslint/no-useless-constructor': 'off' },
  },
  {
    settings: { next: { rootDir: import.meta.dirname } },
    rules: {
      // Props are validated by TypeScript.
      'react/prop-types': 'off',
    },
  },
];

export default config;
