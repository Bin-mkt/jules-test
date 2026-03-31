import { exec } from 'child_process';
import { BrowserWindow } from 'electron';
import * as os from 'os';

export class CommandExecutor {
  private mainWindow: BrowserWindow;
  private workingDirectory: string;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.workingDirectory = os.homedir();
  }

  public execute(command: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      this.mainWindow.webContents.send('log-message', { message: `$ ${command}`, type: 'command' });

      exec(command, { cwd: this.workingDirectory }, (error, stdout, stderr) => {
        if (error) {
           this.mainWindow.webContents.send('log-message', { message: stderr || error.message, type: 'error' });
           resolve({ stdout: '', stderr: stderr || error.message });
        } else {
           if (stdout) {
             this.mainWindow.webContents.send('log-message', { message: stdout, type: 'success' });
           }
           resolve({ stdout, stderr });
        }
      });
    });
  }
}
