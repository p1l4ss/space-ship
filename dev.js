require('./server.js');

run('build-js');
run('copy-tabler-icons-css');
run('copy-tabler-icons-fonts');

function run(cmd) {
  const cp = require('child_process');
  const npmPath = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = cp.spawn(npmPath, ['run', cmd]);
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
}
