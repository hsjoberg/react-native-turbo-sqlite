const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const targetDir = path.resolve(projectRoot, 'cpp');

fs.rmSync(path.resolve(targetDir, 'build'), { recursive: true, force: true });

console.log('Running @react-native-community/cli codegen...');

execSync(
  'npx @react-native-community/cli codegen --platform android --path . --outputPath ./cpp/',
  {
    cwd: projectRoot,
    stdio: 'inherit',
  }
);

const androidDir = path.resolve(targetDir, 'android');
const sourcePath = path.resolve(androidDir, 'app/build');
const destPath = path.resolve(targetDir, 'build');

fs.cpSync(sourcePath, destPath, { recursive: true, force: true });
fs.rmSync(androidDir, { recursive: true, force: true });

console.log('Codegen specs generated successfully');
