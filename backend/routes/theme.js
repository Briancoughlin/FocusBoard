import express from 'express';
import { execSync } from 'child_process';

const router = express.Router();

function getWindowsTheme() {
  try {
    // Get accent colour — registry value is ABGR 32-bit integer
    const accentCmd = `powershell -NoProfile -Command "$v = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\DWM').AccentColor; $r = $v -band 0xFF; $g = ($v -shr 8) -band 0xFF; $b = ($v -shr 16) -band 0xFF; '#{0:X2}{1:X2}{2:X2}' -f $r,$g,$b"`;
    const accentColor = execSync(accentCmd, { encoding: 'utf8', timeout: 3000 }).trim();

    // Get dark/light mode: 0 = dark, 1 = light
    const modeCmd = `powershell -NoProfile -Command "(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize').AppsUseLightTheme"`;
    const modeResult = execSync(modeCmd, { encoding: 'utf8', timeout: 3000 }).trim();
    const isDark = modeResult === '0';

    return { accentColor, isDark, source: 'windows' };
  } catch {
    // Fallback for non-Windows or registry read failure
    return { accentColor: '#0078d4', isDark: false, source: 'fallback' };
  }
}

router.get('/', (_req, res) => {
  const theme = getWindowsTheme();
  res.json(theme);
});

export default router;
