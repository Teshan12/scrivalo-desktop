// Scrivalo for desktop (Windows and Mac).
//
// A real installed app, not a browser tab: its own window, taskbar/Dock icon, menu and notifications, and it stays signed in.
// It shows the live app at app.scrivalo.com, so everything that ships to the web is in the desktop app straight away, with
// no separate update to install. The web app already keeps working offline (service worker), and this shell keeps its own
// copy of the site's saved data in a dedicated profile, exactly like an installed browser app.
//
// Run it:        npm install, then npm start
// Build Windows: npm run dist:win     (installer in dist/)
// Build Mac:     npm run dist:mac     (must be run on a Mac, or by the GitHub workflow in .github/workflows/desktop.yml)

const { app, BrowserWindow, Menu, shell, session, dialog, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_URL = process.env.SCRIVALO_URL || 'https://app.scrivalo.com/';
const APP_HOST = new URL(APP_URL).hostname;
// Sign-in and payment pages the app itself sends people to. Everything else opens in their normal browser.
const IN_APP_HOSTS = [
  APP_HOST, 'scrivalo.com', 'www.scrivalo.com',
  'accounts.google.com', 'accounts.youtube.com',
  'jumzssfmvgtpyjjiikyc.supabase.co',
  'www.paypal.com', 'paypal.com', 'www.sandbox.paypal.com',
  'challenges.cloudflare.com',
];
const hostAllowed = (u) => { try { const h = new URL(u).hostname; return IN_APP_HOSTS.some((x) => h === x || h.endsWith('.' + x)); } catch (e) { return false; } };

// One window, one copy. A second launch just brings the first to the front.
if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
function loadState() {
  try { const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8')); if (s && s.width > 400 && s.height > 300) return s; } catch (e) {}
  return { width: 1280, height: 820 };
}
function saveState() {
  if (!win || win.isDestroyed()) return;
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, max: win.isMaximized() }));
  } catch (e) {}
}

function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    width: st.width, height: st.height, x: st.x, y: st.y,
    minWidth: 480, minHeight: 600,
    show: false,
    title: 'Scrivalo',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#161616' : '#f5f5f5',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      partition: 'persist:scrivalo',
      spellcheck: true,
    },
  });
  if (st.max) win.maximize();
  win.once('ready-to-show', () => win.show());

  // The web app can tell it is running as the desktop app (to hide its own "install" prompts).
  const ua = win.webContents.getUserAgent().replace(/\sElectron\/[\d.]+/, '') + ' ScrivaloDesktop/' + app.getVersion();
  win.webContents.setUserAgent(ua);

  win.loadURL(APP_URL);

  // Right-click on a misspelt word: suggestions at the top, and add to dictionary. Other right-clicks in a text field get cut, copy and paste.
  win.webContents.on('context-menu', (_e, params) => {
    const items = [];
    if (params.misspelledWord) {
      params.dictionarySuggestions.slice(0, 5).forEach(s => items.push({ label: s, click: () => win.webContents.replaceMisspelling(s) }));
      if (!params.dictionarySuggestions.length) items.push({ label: 'No suggestions', enabled: false });
      items.push({ label: 'Add to dictionary', click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord) }, { type: 'separator' });
    }
    if (params.isEditable) items.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' });
    else if (params.selectionText) items.push({ role: 'copy' });
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });

  // Links: the app's own pages and sign-in/payment pages open in the app; everything else in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (hostAllowed(url)) {
      // The support page is a full page of its own; everything else that opens is a small sign-in-style window.
      let big = false; try { big = /^\/(support|help)\b/.test(new URL(url).pathname); } catch (e) {}
      return { action: 'allow', overrideBrowserWindowOptions: big ? { autoHideMenuBar: true, width: 1100, height: 820, modal: false } : { autoHideMenuBar: true, width: 520, height: 720, parent: win, modal: false } };
    }
    if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (hostAllowed(url)) return;
    e.preventDefault();
    if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url);
  });

  // No connection and nothing cached: a calm page with a retry, not a blank window.
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMain) => {
    if (!isMain || code === -3) return;      // -3 is a navigation that was cancelled on purpose
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { to: url } });
  });

  win.on('resize', saveState); win.on('move', saveState); win.on('close', saveState);
  win.on('closed', () => { win = null; });
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  const go = (p) => () => { if (win) win.loadURL(new URL(p, APP_URL).href); };
  const template = [
    ...(mac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [
      { label: 'New window', accelerator: 'CmdOrCtrl+Shift+N', click: () => createWindow() },
      { label: 'Go to dashboard', accelerator: 'CmdOrCtrl+Shift+H', click: go('/') },
      { type: 'separator' },
      mac ? { role: 'close' } : { role: 'quit' },
    ] },
    { role: 'editMenu' },
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'forceReload' }, { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
      { role: 'togglefullscreen' },
      ...(app.isPackaged ? [] : [{ type: 'separator' }, { role: 'toggleDevTools' }]),
    ] },
    { role: 'windowMenu' },
    { role: 'help', submenu: [
      { label: 'Scrivalo help and support', click: () => shell.openExternal('https://app.scrivalo.com/contact') },
      { label: 'Privacy', click: () => shell.openExternal('https://app.scrivalo.com/privacy') },
      { label: 'Terms', click: () => shell.openExternal('https://app.scrivalo.com/terms') },
      { type: 'separator' },
      { label: 'About Scrivalo ' + app.getVersion(), click: () => dialog.showMessageBox({ type: 'info', title: 'Scrivalo', message: 'Scrivalo ' + app.getVersion(), detail: 'The AI workspace for students.\nhttps://app.scrivalo.com', buttons: ['OK'] }) },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  // Microphone (voice input), notifications and clipboard are things the app really uses; nothing else is granted.
  const ses = session.fromPartition('persist:scrivalo');
  const GRANT = new Set(['media', 'notifications', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen']);
  ses.setPermissionRequestHandler((wc, permission, cb) => cb(GRANT.has(permission) && hostAllowed(wc.getURL())));
  ses.setPermissionCheckHandler((wc, permission) => GRANT.has(permission));

  // Red squiggles under misspelt words. On Windows and Linux the dictionary for each language is fetched the first time it is used,
  // so name the languages up front: the computer's own plus English. (macOS uses the system checker and ignores this.)
  try {
    const avail = new Set(ses.availableSpellCheckerLanguages || []);
    const want = [app.getLocale(), 'en-US'].filter((l, i, a) => l && avail.has(l) && a.indexOf(l) === i);
    if (want.length) ses.setSpellCheckerLanguages(want);
    ses.setSpellCheckerEnabled(true);
  } catch (e) {}

  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// Windows needs this for notifications to carry the app's name.
if (process.platform === 'win32') app.setAppUserModelId('com.scrivalo.desktop');
