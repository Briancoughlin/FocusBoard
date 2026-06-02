import { Service } from 'node-windows';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svc = new Service({
  name: 'FocusBoard',
  description: 'FocusBoard ADHD task aggregator',
  script: path.join(__dirname, 'server.js'),
  nodeOptions: ['--experimental-vm-modules'],
  workingDirectory: __dirname,
  allowServiceLogon: true,
});

svc.on('install', () => {
  console.log('FocusBoard service installed. Starting...');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('Service already installed.');
});

svc.on('error', (err) => {
  console.error('Service error:', err);
});

svc.install();
