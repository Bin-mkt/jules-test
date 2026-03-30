import { app, BrowserWindow, BrowserView, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { CommandExecutor } from './CommandExecutor';

let mainWindow: BrowserWindow;
let aiView: BrowserView;
let executor: CommandExecutor;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  aiView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setBrowserView(aiView);

  // Set initial bounds
  const updateBounds = () => {
    const bounds = mainWindow.getContentBounds();
    aiView.setBounds({ x: 0, y: 0, width: Math.floor(bounds.width / 2), height: bounds.height });
  };

  updateBounds();

  mainWindow.on('resize', updateBounds);

  aiView.webContents.loadURL('https://chat.openai.com');

  executor = new CommandExecutor(mainWindow);

  // Open DevTools for debugging
  // aiView.webContents.openDevTools();
}

ipcMain.on('local-exec', (event, command) => {
  const commandId = Math.random().toString(36).substring(7);
  mainWindow.webContents.send('request-confirmation', { commandId, command });
});

ipcMain.on('confirm-exec', async (event, { commandId, command, confirmed }) => {
  if (confirmed && executor && aiView) {
    const { stdout, stderr } = await executor.execute(command);
    const output = stdout || stderr || 'Command executed with no output.';

    // Inject the output back into the AI's chat input box
    const formattedOutput = `Local Execution Output:\n\`\`\`\n${output}\n\`\`\`\n`;
    const escapedOutput = JSON.stringify(formattedOutput);

    const injectScript = `
      (function() {
        const inputBox = document.querySelector('#prompt-textarea') || document.querySelector('.prose-input');
        if (inputBox) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
          nativeInputValueSetter.call(inputBox, ${escapedOutput});
          inputBox.dispatchEvent(new Event('input', { bubbles: true }));

          // Simulate pressing enter or clicking the send button
          const sendButton = document.querySelector('[data-testid="send-button"]');
          if (sendButton && !sendButton.disabled) {
            sendButton.click();
          }
        }
      })();
    `;

    aiView.webContents.executeJavaScript(injectScript).catch(err => {
      console.error('Failed to inject execution output back to AI view:', err);
    });
  } else if (!confirmed && aiView) {
    const formattedOutput = `Local Execution Output:\n\`\`\`\nUser rejected the command execution.\n\`\`\`\n`;
    const escapedOutput = JSON.stringify(formattedOutput);
    const injectScript = `
      (function() {
        const inputBox = document.querySelector('#prompt-textarea') || document.querySelector('.prose-input');
        if (inputBox) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
          nativeInputValueSetter.call(inputBox, ${escapedOutput});
          inputBox.dispatchEvent(new Event('input', { bubbles: true }));

          // Simulate pressing enter or clicking the send button
          const sendButton = document.querySelector('[data-testid="send-button"]');
          if (sendButton && !sendButton.disabled) {
            sendButton.click();
          }
        }
      })();
    `;

    aiView.webContents.executeJavaScript(injectScript).catch(err => {
      console.error('Failed to inject execution output back to AI view:', err);
    });
  }
});

ipcMain.handle('get-config', () => {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to read config.json', error);
    return null;
  }
});

ipcMain.on('request-read-file', async () => {
  if (!mainWindow || !aiView) return;

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) return;

  const filePath = filePaths[0];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const formattedOutput = `File Context (${path.basename(filePath)}):\n${content}`;
    const escapedOutput = JSON.stringify(formattedOutput);

    const injectScript = `
      (function() {
        const inputBox = document.querySelector('#prompt-textarea') || document.querySelector('.prose-input');
        if (inputBox) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
          nativeInputValueSetter.call(inputBox, ${escapedOutput});
          inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })();
    `;

    aiView.webContents.executeJavaScript(injectScript).catch(err => {
      console.error('Failed to inject file content back to AI view:', err);
    });

    mainWindow.webContents.send('log-message', { message: `Read file: ${filePath}`, type: 'info' });
  } catch (error: any) {
    mainWindow.webContents.send('log-message', { message: `Error reading file: ${error.message}`, type: 'error' });
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
