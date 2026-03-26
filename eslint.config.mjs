import globals from 'globals';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';

const typedFiles = ['apps/**/*.{ts,tsx,mts,cts}', 'packages/**/*.{ts,tsx,mts,cts}'];
const webFiles = ['apps/web/**/*.{ts,tsx,mts,cts}'];
const apiFiles = ['apps/api/**/*.{ts,mts,cts}'];
const testFiles = [
  'apps/**/*.spec.ts',
  'apps/**/*.test.ts',
  'apps/**/__tests__/**/*.{ts,tsx}',
  'apps/api/test/**/*.ts',
];

const scopeConfigs = (configs, files) =>
  configs.map((config) => ({
    ...config,
    files,
  }));

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.pnpm/**',
      '**/next-env.d.ts',
      'apps/api/prisma/migrations/**',
    ],
  },
  ...scopeConfigs(
    [...tseslint.configs.recommendedTypeChecked, ...tseslint.configs.strictTypeChecked],
    typedFiles,
  ),
  {
    files: typedFiles,
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
      '@typescript-eslint/only-throw-error': 'error',
    },
  },
  {
    files: apiFiles,
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['apps/api/src/**/*.module.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  ...scopeConfigs([...nextCoreWebVitals, ...nextTypescript], webFiles),
  {
    files: webFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      next: {
        rootDir: 'apps/web',
      },
    },
    rules: {
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    files: testFiles,
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unsafe-type-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
