const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const targetDir = path.resolve(projectRoot, 'cpp');

fs.rmSync(path.resolve(targetDir, 'build'), { recursive: true, force: true });

process.argv = [
  ...process.argv.slice(0, 2),
  '--targetPlatform',
  'android',
  '--path',
  projectRoot,
  '--outputPath',
  targetDir,
];

require('react-native/scripts/generate-codegen-artifacts');

// move targetdir/android/app/build to targetdir/
fs.renameSync(
  path.resolve(targetDir, 'android/app/build'),
  path.resolve(targetDir, 'build'),
);

// Remove android folder
fs.rmSync(path.resolve(targetDir, 'android'), { recursive: true });

console.log('Codegen specs generated successfully');
