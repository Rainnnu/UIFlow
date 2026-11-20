import { createRequire } from 'node:module';
import { cp, copyFile, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createVSIX } from '@vscode/vsce';

// A fresh staging directory avoids pnpm symlinks and excludes all test/user workspaces.
const root = resolve('.');
await mkdir(join(root, '.test-output'), { recursive: true });
const stage = await mkdtemp(join(root, '.test-output', 'package-'));
const manifest = JSON.parse(await readFile(join(root, 'apps/vscode-extension/package.json'), 'utf8'));
manifest.license = 'UNLICENSED';
await writeFile(join(stage, 'package.json'), JSON.stringify(manifest, null, 2));
await mkdir(join(stage, 'dist'), { recursive: true });
await copyFile(join(root, 'apps/vscode-extension/dist/extension.cjs'), join(stage, 'dist/extension.cjs'));
await cp(join(root, 'apps/vscode-extension/dist/webview'), join(stage, 'dist/webview'), { recursive: true });
const require = createRequire(import.meta.url);
const typescriptRoot = dirname(require.resolve('typescript/package.json'));
await cp(typescriptRoot, join(stage, 'node_modules/typescript'), { recursive: true, dereference: true });
await cp(join(root, 'tests/fixtures/m1'), join(stage, 'samples/demo-react'), { recursive: true });
const sampleManifest = JSON.parse(await readFile(join(root, 'apps/demo-react/package.json'), 'utf8'));
sampleManifest.devDependencies = { '@types/react': '19.1.6' };
await writeFile(join(stage, 'samples/demo-react/package.json'), JSON.stringify(sampleManifest, null, 2));
await writeFile(join(stage, 'samples/demo-react/README.md'), '# UIFlow example\n\nCopy this folder to a local workspace, install its dependencies yourself, then open ProductPage.tsx and run UIFlow: 查看当前组件结构. UIFlow never installs or runs project scripts automatically.\n');
// Include upstream license texts for every bundled runtime dependency, without executing them.
const visited = new Set(); const notices = [];
const graphRequire = createRequire(join(root, 'packages/graph-ui/package.json'));
async function licenses(name, resolver) {
  let manifestPath;
  try { manifestPath = resolver.resolve(`${name}/package.json`); }
  catch {
    let folder = dirname(resolver.resolve(name));
    for (;;) {
      try { const candidate = JSON.parse(await readFile(join(folder, 'package.json'), 'utf8')); if (candidate.name === name) { manifestPath = join(folder, 'package.json'); break; } } catch {}
      const parent = dirname(folder); if (parent === folder) throw new Error(`Cannot locate license package: ${name}`); folder = parent;
    }
  }
  const folder = dirname(manifestPath); const pkg = JSON.parse(await readFile(manifestPath, 'utf8'));
  const key = `${pkg.name}@${pkg.version}`; if (visited.has(key)) return; visited.add(key);
  const files = (await readdir(folder, { withFileTypes: true })).filter(file => file.isFile() && /^(licen[sc]e|copying|notice)/i.test(file.name));
  notices.push(`## ${key}\n\nLicense: ${pkg.license ?? 'See upstream package'}\n\n` + (await Promise.all(files.map(async file => `### ${file.name}\n\n${await readFile(join(folder, file.name), 'utf8')}`))).join('\n\n'));
  const nested = createRequire(manifestPath);
  for (const dependency of Object.keys(pkg.dependencies ?? {})) await licenses(dependency, nested);
}
for (const name of ['react', 'react-dom', '@xyflow/react']) await licenses(name, graphRequire);
await licenses('typescript', require);
await writeFile(join(stage, 'THIRD_PARTY_NOTICES.md'), '# Third-party notices\n\n' + notices.join('\n\n'));
await copyFile(join(root, 'README.md'), join(stage, 'README.md'));
await writeFile(join(stage, '.vscodeignore'), 'node_modules/typescript/bin/**\nnode_modules/typescript/lib/typingsInstaller.js\nnode_modules/typescript/lib/tsserver.js\nnode_modules/typescript/lib/tsserverlibrary.js\nnode_modules/typescript/lib/watchGuard.js\n');
const artifacts = join(root, 'artifacts'); await mkdir(artifacts, { recursive: true });
const artifact = join(artifacts, `${manifest.name}-${manifest.version}.vsix`);
await createVSIX({ cwd: stage, packagePath: artifact, useYarn: false, dependencies: true, allowMissingRepository: true, skipLicense: true, rewriteRelativeLinks: false });
const bytes = await readFile(artifact);
await writeFile(`${artifact}.sha256`, `${createHash('sha256').update(bytes).digest('hex')}  ${manifest.name}-${manifest.version}.vsix\n`);
await writeFile(join(root, '.test-output', 'package-result.json'), JSON.stringify({ artifact, stage, bytes: bytes.length, typescriptVersion: require('typescript/package.json').version, sha256: createHash('sha256').update(bytes).digest('hex') }, null, 2));
console.log(`Packaged ${artifact} (${bytes.length} bytes)`);
