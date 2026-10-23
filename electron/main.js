// Desktop app: starts the local server on a random port and shows the dashboard in its own window.
import { app, BrowserWindow, dialog, session } from 'electron';
import { startServer } from '../server/index.js';

// Only one copy at a time, so two windows never write the same data file at once.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win = null;

  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.on('window-all-closed', () => app.quit());

  app.whenReady().then(async () => {
    let url;
    try {
      ({ url } = await startServer({ port: 0 })); // port 0 = any free port, so it never clashes
    } catch (err) {
      dialog.showErrorBox('Finance Dashboard', `Could not start: ${err.message}`);
      app.quit();
      return;
    }

    // The dashboard never needs the camera, notifications, location, etc.
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, callback) => callback(false));

    win = new BrowserWindow({
      width: 1280,
      height: 900,
      minWidth: 420,
      minHeight: 500,
      title: 'Finance Dashboard',
      backgroundColor: '#0f1115',
      autoHideMenuBar: true,
      webPreferences: {
        // Electron's recommended lockdown: the page gets no Node.js or system access.
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });

    // Never leave the local app or open new windows, even if something tries to.
    const isLocal = (target) => target === url || target.startsWith(`${url}/`) || target.startsWith(`${url}#`);
    win.webContents.on('will-navigate', (event, target) => {
      if (!isLocal(target)) event.preventDefault();
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    win.on('closed', () => (win = null));
    await win.loadURL(url);
  });
}
