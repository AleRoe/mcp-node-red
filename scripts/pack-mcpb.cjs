const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const stageDir = path.join(rootDir, '.mcpb-build');
const outputFile = path.join(rootDir, 'mcp-node-red.mcpb');

const filesToCopy = ['manifest.json', 'package.json', 'package-lock.json', 'README.md', 'LICENSE', 'CHANGELOG.md'];
const directoriesToCopy = ['dist'];

function run(command, args, cwd) {
  const isWindowsPackageCommand =
    process.platform === 'win32' && (command === 'npm' || command === 'npx');

  const result = isWindowsPackageCommand
    ? spawnSync(
        'cmd.exe',
        ['/d', '/s', '/c', [command, ...args].map(quoteForCmd).join(' ')],
        {
          cwd,
          stdio: 'inherit',
          shell: false,
        }
      )
    : spawnSync(command, args, {
        cwd,
        stdio: 'inherit',
        shell: false,
      });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function quoteForCmd(value) {
  return /[\s"]/u.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function ensureFileExists(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Required file or directory is missing: ${relativePath}`);
  }
}

function copyIntoStage(relativePath) {
  const source = path.join(rootDir, relativePath);
  const target = path.join(stageDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function main() {
  ensureFileExists('dist/index.js');
  ensureFileExists('manifest.json');
  ensureFileExists('package.json');
  ensureFileExists('package-lock.json');

  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });

  try {
    for (const file of filesToCopy) {
      copyIntoStage(file);
    }

    for (const directory of directoriesToCopy) {
      copyIntoStage(directory);
    }

    run('npm', ['install', '--omit=dev', '--ignore-scripts'], stageDir);
    run('npx', ['@anthropic-ai/mcpb', 'validate', stageDir], rootDir);
    run('npx', ['@anthropic-ai/mcpb', 'pack', stageDir, outputFile], rootDir);
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
}

main();
