const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
  // Cria a janela do aplicativo de desktop
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "RoFlow - Suíte Petrofísica",
    // icon: path.join(__dirname, 'public/roncore-logo-v5.png'), // Descomente depois se quiser o ícone na barra!
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false // Necessário se quiser usar nodeIntegration: true puro
    }
  });

  // Remove a barra de menus feia do topo (File, Edit, View...)
  win.setMenuBarVisibility(false);

  // Carrega o arquivo final que o Vite vai gerar
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));

  // ⚠️ LIGANDO O RAIO-X (Ferramentas de Desenvolvedor)
  win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
