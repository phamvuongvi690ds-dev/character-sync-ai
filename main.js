const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const Store = require('electron-store');

const store = new Store();

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 720,
    title: 'CharacterSync AI',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.handle('config:get', () => {
  return store.get('config', {
    baseUrl: 'http://93.127.141.198:8000',
    apiKey: '8d68d3f65067ce72c04ecb600f2a29dd5c518282e3c018f2',
    model: 'gemini-2.5-flash'
  });
});

ipcMain.handle('config:set', (_event, config) => {
  store.set('config', config);
  return { ok: true };
});

ipcMain.handle('file:readImage', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select character image',
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  const base64 = fs.readFileSync(filePath).toString('base64');
  return { filePath, mime, base64 };
});


ipcMain.handle('file:readVideo', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select reference video',
    filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const mimeMap = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska' };
  const mime = mimeMap[ext] || 'video/mp4';
  const stat = fs.statSync(filePath);
  const maxBytes = 18 * 1024 * 1024;
  if (stat.size > maxBytes) {
    return { error: `Video too large (${Math.round(stat.size/1024/1024)}MB). Please use a short clip under 18MB.` };
  }
  const base64 = fs.readFileSync(filePath).toString('base64');
  return { filePath, mime, base64, size: stat.size };
});

ipcMain.handle('gemini:generate', async (_event, { config, body, model }) => {
  const url = `${config.baseUrl.replace(/\/$/, '')}/v1beta/models/${model || config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  try {
    const res = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' }, timeout: 180000 });
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: err.response?.data || err.message };
  }
});

ipcMain.handle('file:saveText', async (_event, { filename, text }) => {
  const dir = path.join(app.getPath('downloads'), 'CharacterSyncAI');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, text, 'utf8');
  return filePath;
});
