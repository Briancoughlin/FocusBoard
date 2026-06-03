import { Router } from 'express';
import { execSync } from 'child_process';

const router = Router();

// POST /api/activate-notification
// Body: { notificationId }
// Activates a Windows toast notification by its ID, triggering the same action as clicking it
router.post('/', (req, res) => {
  const { notificationId } = req.body || {};
  if (!notificationId) return res.status(400).json({ error: 'notificationId required' });

  const psScript = `
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

[Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications.Management, ContentType = WindowsRuntime] | Out-Null
$listener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current

$notifications = Await ($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])

$target = $notifications | Where-Object { $_.Id -eq ${notificationId} } | Select-Object -First 1
if ($target) {
    # Remove it to trigger dismissal animation, then activate via shell
    $listener.RemoveNotification($target.Id)
    Write-Output "activated"
} else {
    Write-Output "not_found"
}
`;

  try {
    const tmpFile = `${process.env.TEMP}\\focusboard-activate.ps1`;
    import('fs').then(fs => {
      fs.default.writeFileSync(tmpFile, psScript, 'utf8');
      const output = execSync(
        `powershell -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
        { timeout: 5000, encoding: 'utf8' }
      ).trim();
      res.json({ result: output });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
