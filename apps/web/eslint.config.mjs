import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import root from '../../eslint.config.mjs';

const config = [
  ...root,
  ...nextCoreWebVitals,
  {
    settings: { next: { rootDir: import.meta.dirname } },
    rules: {
      // Props are validated by TypeScript.
      'react/prop-types': 'off',
    },
  },
];

export default config;
