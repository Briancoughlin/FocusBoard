import { Service } from 'node-windows';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svc = new Service({
  name: 'FocusBoard',
  script: path.join(__dirname, 'server.js'),
});

svc.on('uninstall', () => {
  console.log('FocusBoard service removed.');
});

svc.uninstall();
