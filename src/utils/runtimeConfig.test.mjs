import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveOptionalSupabasePublicUrl,
  validateFrontendBuildEnv,
  validateProductionApiUrl
} from './runtimeConfig.js';

const SOURCE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const FORBIDDEN_PRODUCTION_PROJECT = ['ooo', 'feoziqaoqcufifqci'].join('');
const FORBIDDEN_PRODUCTION_API = ['https://api', '.jonnyshn.com'].join('');
const FORBIDDEN_SECRET_ROLE = ['service', '_role'].join('');

const listRuntimeSourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listRuntimeSourceFiles(entryPath);
    if (!/\.[cm]?[jt]sx?$/.test(entry.name) || /\.test\.[cm]?[jt]sx?$/.test(entry.name)) return [];
    return [entryPath];
  }));
  return files.flat();
};

test('el codigo runtime no contiene fallbacks ni secretos prohibidos', async () => {
  const sourceFiles = await listRuntimeSourceFiles(SOURCE_ROOT);
  const runtimeSource = (await Promise.all(sourceFiles.map((file) => readFile(file, 'utf8')))).join('\n');

  assert.doesNotMatch(runtimeSource, new RegExp(FORBIDDEN_PRODUCTION_PROJECT, 'i'));
  assert.doesNotMatch(runtimeSource, new RegExp(FORBIDDEN_PRODUCTION_API.replaceAll('.', '\\.'), 'i'));
  assert.doesNotMatch(runtimeSource, new RegExp(FORBIDDEN_SECRET_ROLE, 'i'));
});

test('el build rechaza VITE_API_URL ausente', () => {
  assert.throws(() => validateFrontendBuildEnv({}), /VITE_API_URL.*obligatoria/);
});

test('el build rechaza localhost y 127.0.0.1', () => {
  assert.throws(() => validateProductionApiUrl('https://localhost:3443'), /localhost/);
  assert.throws(() => validateProductionApiUrl('https://127.0.0.1:3001'), /localhost/);
});

test('el build rechaza HTTP inseguro y URL malformada', () => {
  assert.throws(() => validateProductionApiUrl('http://api-qa.jonnyshn.com'), /HTTPS/);
  assert.throws(() => validateProductionApiUrl('api-qa.jonnyshn.com'), /URL valida/);
});

test('el build acepta el backend QA por HTTPS', () => {
  assert.equal(
    validateProductionApiUrl('https://api-qa.jonnyshn.com/'),
    'https://api-qa.jonnyshn.com'
  );
});

test('Supabase ausente o invalido degrada el recurso publico a URL vacia', () => {
  assert.equal(resolveOptionalSupabasePublicUrl(), '');
  assert.equal(resolveOptionalSupabasePublicUrl('http://localhost:54321'), '');
  assert.equal(
    resolveOptionalSupabasePublicUrl('https://cluideiojeikzcmmizhe.supabase.co/'),
    'https://cluideiojeikzcmmizhe.supabase.co'
  );
});

test('Navbar omite solo el audio sin Supabase y conserva autenticacion', async () => {
  const navbar = await readFile(new URL('../components/layout/Navbar.jsx', import.meta.url), 'utf8');

  assert.match(navbar, /const NOTIFICATION_SOUND_URL = SUPABASE_PUBLIC_BASE[\s\S]*: '';/);
  assert.match(navbar, /if \(!NOTIFICATION_SOUND_URL\) return null;/);
  assert.match(navbar, /const \{[\s\S]*logout[\s\S]*\} = useAuth\(\);/);
  assert.match(navbar, /await logout\(\);/);
});

test('el build sanea fallbacks localhost incluidos por dependencias', async () => {
  const viteConfig = await readFile(new URL('../../vite.config.js', import.meta.url), 'utf8');

  assert.match(viteConfig, /scrubBundledLocalhostFallbacks/);
  assert.match(viteConfig, /replaceAll\('http:\/\/localhost', 'https:\/\/invalid\.local'\)/);
});
