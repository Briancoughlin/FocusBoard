/**
 * @file watchdog.js
 * Lightweight watchdog process that runs independently of the main server.
 * Listens on port 3002 and can restart the FocusBoard scheduled task on demand.
 *
 * Because it's a separate process, it survives crashes of the main server
 * and can be called from the offline recovery page to restart FocusBoard.
 */

import http from 'http';
import { execSync } from 'child_process';
import { printBanner, printReady, printWarning } from './startup.js';

const PORT = 3002;

const server = http.createServer((req, res) => {
  // CORS headers so the offline.html page (served from file or cache) can call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/restart' && req.method === 'POST') {
    console.log('[Watchdog] Restart requested');
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, message: 'Restarting FocusBoard...' }));

    // Restart the scheduled task after a short delay so the response is sent first
    setTimeout(() => {
      try {
        execSync('powershell -NonInteractive -Command "Stop-ScheduledTask -TaskName FocusBoard -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2; Start-ScheduledTask -TaskName FocusBoard"', {
          timeout: 15000,
        });
        process.stdout.write('  \x1b[32m✓\x1b[0m  FocusBoard restarted successfully\n');
      } catch (err) {
        printWarning(`Restart failed: ${err.message}`);
      }
    }, 500);
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ alive: true, watchdog: true }));
    return;
  }

  // Check if main server is alive
  if (req.url === '/status' && req.method === 'GET') {
    import('http').then(({ default: http }) => {
      const check = http.get('http://127.0.0.1:3001/', (r) => {
        res.writeHead(200);
        res.end(JSON.stringify({ mainServer: r.statusCode === 200, watchdog: true }));
        check.destroy();
      });
      check.on('error', () => {
        res.writeHead(200);
        res.end(JSON.stringify({ mainServer: false, watchdog: true }));
      });
      check.setTimeout(2000, () => {
        res.writeHead(200);
        res.end(JSON.stringify({ mainServer: false, watchdog: true }));
        check.destroy();
      });
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  printBanner(PORT, process.version);
  process.stdout.write('  \x1b[2m  Watchdog — monitors FocusBoard and restarts on demand\x1b[0m\n\n');
  printReady();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    process.stdout.write(`  \x1b[33m⚠\x1b[0m  Port ${PORT} already in use — another watchdog may be running\n`);
  } else {
    printWarning(`Watchdog error: ${err.message}`);
  }
});
