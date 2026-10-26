import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Enforces the modular-monolith boundaries described in ARCHITECTURE.md §4.2.
 * Plain static analysis of import specifiers: no extra tooling required.
 */
const SRC = fileURLToPath(new URL('../src', import.meta.url));
const MODULES = path.join(SRC, 'modules');

/** Module directory -> PostgreSQL schema it owns (null: owns no tables). */
const OWNED_SCHEMA: Record<string, string | null> = {
  identity: 'identity',
  content: 'content',
  vocabulary: 'vocabulary',
  learning: 'learning',
  progress: 'progress',
  'ai-gateway': null,
};

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

const IMPORT =
  /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(IMPORT)].map((match) => (match[1] ?? match[2])!);
}

const moduleOf = (file: string): string | null => {
  const relative = path.relative(MODULES, file);
  return relative.startsWith('..') ? null : relative.split(path.sep)[0]!;
};

describe('module boundaries', () => {
  const moduleNames = readdirSync(MODULES);
  const dependencies = new Map<string, Set<string>>(moduleNames.map((name) => [name, new Set()]));
  const violations: string[] = [];

  for (const file of listFiles(SRC)) {
    const owner = moduleOf(file);
    for (const specifier of importsOf(file)) {
      const where = `${path.relative(SRC, file)} -> ${specifier}`;

      if (specifier.startsWith('.')) {
        const target = path.resolve(path.dirname(file), specifier).replace(/\.js$/, '.ts');
        const targetModule = moduleOf(target);
        if (
          owner === null &&
          targetModule !== null &&
          path.relative(SRC, file).startsWith('platform')
        ) {
          violations.push(`platform must not depend on modules: ${where}`);
        }
        if (owner !== null && targetModule !== null && targetModule !== owner) {
          if (target !== path.join(MODULES, targetModule, 'index.ts')) {
            violations.push(`only the public index.ts of another module may be imported: ${where}`);
          }
          dependencies.get(owner)!.add(targetModule);
        }
      }

      const schema = /^@lingoup\/database\/schema\/(.+)$/.exec(specifier)?.[1];
      if (schema !== undefined) {
        const allowed = owner === null ? schema === 'platform' : OWNED_SCHEMA[owner] === schema;
        if (!allowed)
          violations.push(`tables of schema "${schema}" belong to another module: ${where}`);
      }
    }
  }

  it('modules use only public APIs, their own tables, and platform stays independent', () => {
    expect(violations).toEqual([]);
  });

  it('every module declares the schema it owns', () => {
    expect(moduleNames.sort()).toEqual(Object.keys(OWNED_SCHEMA).sort());
  });

  it('module dependencies are acyclic', () => {
    const visiting = new Set<string>();
    const done = new Set<string>();
    const cycles: string[] = [];
    const visit = (node: string, trail: string[]) => {
      if (done.has(node)) return;
      if (visiting.has(node)) {
        cycles.push([...trail, node].join(' -> '));
        return;
      }
      visiting.add(node);
      for (const next of dependencies.get(node) ?? []) visit(next, [...trail, node]);
      visiting.delete(node);
      done.add(node);
    };
    for (const node of dependencies.keys()) visit(node, []);
    expect(cycles).toEqual([]);
  });
});
