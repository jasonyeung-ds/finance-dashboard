// Encrypts secrets (Plaid access tokens) with Windows DPAPI, tied to your Windows account.
// Only you, logged into this Windows user on this PC, can decrypt them. Works the same from
// `npm run dev` and the desktop app, so both can read the same saved connections.
import { execFile } from 'node:child_process';

const PROTECT = `
Add-Type -AssemblyName System.Security
$bytes = [Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd())
[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($bytes, $null, 'CurrentUser'))`;

const UNPROTECT = `
Add-Type -AssemblyName System.Security
$bytes = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, 'CurrentUser'))`;

function runPowerShell(script, input) {
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('Bank connections are only supported on Windows (they rely on Windows encryption).'));
  }
  return new Promise((resolve, reject) => {
    // The secret goes through stdin, never the command line, so it can't show up in process listings.
    const child = execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 },
      (err, stdout) => (err ? reject(new Error('Windows encryption failed')) : resolve(stdout.trim())),
    );
    child.stdin.end(input);
  });
}

export const encryptSecret = (plain) => runPowerShell(PROTECT, plain);
export const decryptSecret = (encrypted) => runPowerShell(UNPROTECT, encrypted);
