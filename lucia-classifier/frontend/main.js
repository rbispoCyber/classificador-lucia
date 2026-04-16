const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// 🚀 FIX: Redireciona os dados do app para fora do OneDrive para evitar erro de "Acesso Negado"
const appName = "PoroKAnalytics_Local";
const localAppData = process.env.LOCALAPPDATA || path.join(process.env.HOME, 'AppData', 'Local');
const localUserDataPath = path.join(localAppData, appName);

if (!fs.existsSync(localUserDataPath)) {
  fs.mkdirSync(localUserDataPath, { recursive: true });
}
app.setPath('userData', localUserDataPath);

// Desativa o cache de GPU se houver erros persistentes de disco
app.commandLine.appendSwitch('disable-gpu-cache');

function createWindow () {
  // Cria a janela do aplicativo de desktop
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "PoroK Analytics",
    icon: path.join(__dirname, 'public/roncore-logo-v8.png'),
    webPreferences: {
      nodeIntegration: false, // Segurança: scripts da página não devem acessar o Node diretamente
      contextIsolation: true, // Segurança: exigido pelo Electron para usar o contextBridge no preload
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Remove a barra de menus feia do topo (File, Edit, View...)
  win.setMenuBarVisibility(false);

  // Carrega o arquivo final que o Vite vai gerar
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));

  // ⚠️ LIGANDO O RAIO-X (Ferramentas de Desenvolvedor)
  win.webContents.openDevTools();
}

// Handlers para os Diálogos nativos de Arquivo e Pasta
ipcMain.handle('open-file-dialog', async () => {
  const mainWindow = BrowserWindow.getFocusedWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }]
  });
  if (canceled) return null;
  
  const filePath = filePaths[0];
  try {
    const buffer = fs.readFileSync(filePath);
    return {
      name: path.basename(filePath),
      // Uint8Array é universal e não estoura a memória do Electron, além de ser 100% suportado pelo XLSX.read
      data: new Uint8Array(buffer)
    };
  } catch (err) {
    return { error: `O Windows bloqueou a leitura. O arquivo está aberto no Excel? Feche a planilha e tente novamente.\n\n[Erro: ${err.message}]` };
  }
});

ipcMain.handle('open-folder-dialog', async () => {
  const mainWindow = BrowserWindow.getFocusedWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (canceled) return null;
  return filePaths[0];
});

// 🚀 FIX: Atende ao canal interno que o Electron às vezes usa para inputs de arquivo
ipcMain.handle('dialog:openFile', async () => {
  const mainWindow = BrowserWindow.getFocusedWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }]
  });
  if (canceled) return null;
  const filePath = filePaths[0];
  try {
    const buffer = fs.readFileSync(filePath);
    return { name: path.basename(filePath), data: new Uint8Array(buffer) };
  } catch (err) {
    return { error: `O Windows bloqueou a leitura. O arquivo está aberto no Excel? Feche a planilha.\n\n[Erro: ${err.message}]` };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
