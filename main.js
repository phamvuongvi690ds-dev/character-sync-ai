const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Xóa bỏ electron-store để tránh lỗi Native Module trên các máy khác nhau
// Chúng ta sẽ dùng file json đơn giản để lưu config
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        }
    } catch (e) { console.error(e); }
    return {
        baseUrl: 'http://93.127.141.198:8000',
        apiKey: '8d68d3f65067ce72c04ecb600f2a29dd5c518282e3c018f2',
        model: 'gemini-2.5-flash'
    };
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (e) { console.error(e); }
}

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
  
  // Mở DevTools để anh dễ xem lỗi nếu có
  // win.webContents.openDevTools();
  
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.handle('config:get', () => {
  return loadConfig();
});

ipcMain.handle('config:set', (_event, config) => {
  saveConfig(config);
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
  const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
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
  if (stat.size > 18 * 1024 * 1024) {
    return { error: 'Video quá lớn (giới hạn 18MB).' };
  }
  const base64 = fs.readFileSync(filePath).toString('base64');
  return { filePath, mime, base64, size: stat.size };
});

ipcMain.handle('gemini:generate', async (_event, { config, body, model }) => {
  const url = `${config.baseUrl.replace(/\/$/, '')}/v1beta/models/${model || config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  try {
    const res = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' }, timeout: 300000 });
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: err.response?.data || err.message };
  }
});

ipcMain.handle('file:saveText', async (_event, { filename, text }) => {
  const dir = path.join(app.getPath('downloads'), 'CharacterSyncAI');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, text, 'utf8');
  return filePath;
});
