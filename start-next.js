const { execSync } = require('child_process');
const command = process.argv[2] === 'build' ? 'npx next build' : 'npx next dev -p 5000';
const { execFileSync } = require('child_process');

if (process.argv[2] === 'build') {
  execSync('npx next build', { stdio: 'inherit' });
} else {
  execSync('npx next dev -p 5000', { stdio: 'inherit' });
}
