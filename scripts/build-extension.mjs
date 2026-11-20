import { build } from 'esbuild';
await build({ entryPoints: ['apps/vscode-extension/src/extension.ts'], bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['vscode', 'typescript'], outfile: 'apps/vscode-extension/dist/extension.cjs' });
await build({ entryPoints: ['tests/integration/run.ts'], bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['vscode', 'typescript'], outfile: 'apps/vscode-extension/dist/integration.cjs' });
await build({ entryPoints: ['tests/integration/structure-run.ts'], bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['vscode', 'typescript'], outfile: 'apps/vscode-extension/dist/structure-integration.cjs' });
await build({ entryPoints: ['tests/integration/data-run.ts'], bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['vscode', 'typescript'], outfile: 'apps/vscode-extension/dist/data-integration.cjs' });
await build({ entryPoints: ['tests/integration/refresh-run.ts'], bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['vscode', 'typescript'], outfile: 'apps/vscode-extension/dist/refresh-integration.cjs' });
await build({ entryPoints: ['tests/integration/installed-run.ts'], bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['vscode'], outfile: 'apps/vscode-extension/dist/installed-integration.cjs' });
