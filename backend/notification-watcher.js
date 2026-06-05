import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { logger } from './logger.js';

const SEEN_IDS = new Set();
const POLL_INTERVAL = 10000; // 10 seconds
const FOCUSBOARD_URL = 'http://localhost:3001/api/slack-notification';

// PowerShell script that reads Slack toast notifications via Windows Runtime API
const PS_SCRIPT = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and
    $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
})[0]

function Await($WinRtTask, $ResultType) {
    $asTaskSpecific = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTaskSpecific.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

try {
    [Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications.Management, ContentType = WindowsRuntime] | Out-Null
    $listener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current

    $accessStatus = Await ($listener.RequestAccessAsync()) ([Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus])
    if ($accessStatus -ne [Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus]::Allowed) {
        Write-Error "PERMISSION_DENIED: Notification access not granted. Enable it in Windows Settings > Privacy > Notifications."
        exit 1
    }

    $notifications = Await ($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])

    foreach ($n in $notifications) {
        try {
            $appInfo = $n.AppInfo
            if (-not $appInfo) { continue }
            $appName = $appInfo.DisplayInfo.DisplayName
            if ($appName -notlike "*Slack*") { continue }

            $binding = $n.Notification.Visual.Bindings | Select-Object -First 1
            if (-not $binding) { continue }
            $texts = @($binding.GetTextElements())
            $title = if ($texts.Count -gt 0) { $texts[0].Text } else { "" }
            $body  = if ($texts.Count -gt 1) { $texts[1].Text } else { "" }

            # Try to get the activation launch URL from the notification
            $launchUrl = ""
            try {
                $toastXml = $n.Notification.Content.GetXml()
                if ($toastXml -match 'launch="([^"]*)"') {
                    $launchUrl = $matches[1]
                }
            } catch {}

            Write-Output "$($n.Id)|$appName|$title|$body|$launchUrl"
        } catch {
            # Skip malformed notifications
        }
    }
} catch {
    if ($_.Exception.Message -like "*PERMISSION_DENIED*") {
        Write-Error $_.Exception.Message
        exit 1
    }
    Write-Error "ERROR: $($_.Exception.Message)"
    exit 2
}
`;

// Write PS script to a temp file to avoid shell-escaping nightmares
const TMP_PS = path.join(os.tmpdir(), 'focusboard-notification-watcher.ps1');
fs.writeFileSync(TMP_PS, PS_SCRIPT, 'utf8');

const HEALTH_PING_URL = 'http://localhost:3001/api/health/watcher/ping';

async function pingHealthEndpoint() {
  try {
    await fetch(HEALTH_PING_URL, { method: 'POST' });
  } catch {
    // Server may not be up yet — ignore silently
  }
}

async function checkNotifications() {
  logger.debug('Notification poll cycle start', {});
  // Ping the health endpoint so the server knows the watcher is alive
  await pingHealthEndpoint();
  try {
    const output = execSync(
      `powershell -NonInteractive -ExecutionPolicy Bypass -File "${TMP_PS}"`,
      { timeout: 8000, encoding: 'utf8' }
    ).trim();

    if (!output) return;

    for (const line of output.split('\n').filter(Boolean)) {
      const parts = line.split('|');
      if (parts.length < 3) continue;
      const [id, appName, rawTitle, ...rest] = parts;
      const launchUrl = rest[rest.length - 1] || '';
      const body = rest.slice(0, -1).join('|');

      // Slack groups all notifications into one — split on channel/sender boundaries
      // Pattern: "#channel-name" or "Person Name" separated by spaces
      const titleParts = rawTitle.trim()
        .split(/(?=#)|\s+(?=[A-Z][a-z])/)
        .map(t => t.trim())
        .filter(Boolean);

      // Only process the first unique sender/channel we haven't seen
      const firstTitle = titleParts[0] || rawTitle.trim();
      const notifId = `${id}-${firstTitle.replace(/\W/g, '')}`;

      if (!notifId || SEEN_IDS.has(notifId)) continue;
      SEEN_IDS.add(notifId);

      try {
        const res = await fetch(FOCUSBOARD_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: notifId, title: firstTitle.trim(), body: body.trim(), appName: appName.trim(), launchUrl: launchUrl.trim() }),
        });

        if (res.ok) {
          logger.info('Notification forwarded', { id: notifId, title: firstTitle });
        } else {
          logger.warn('FocusBoard rejected notification', { id: notifId, status: res.status });
        }
      } catch (fetchErr) {
        logger.error('Could not reach FocusBoard', { error: fetchErr.message });
      }
    }
  } catch (err) {
    const msg = err.stderr || err.message || String(err);
    if (msg.includes('PERMISSION_DENIED')) {
      logger.error('Notification permission denied — enable in Windows Settings > Privacy & Security > Notifications', { retryIn: POLL_INTERVAL / 1000 });
    } else {
      logger.error('Notification check failed', { error: msg.trim() });
    }
  }
}

logger.info('FocusBoard notification watcher starting', { pollIntervalSec: POLL_INTERVAL / 1000 });
checkNotifications();
setInterval(checkNotifications, POLL_INTERVAL);
