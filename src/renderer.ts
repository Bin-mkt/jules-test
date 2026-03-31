const { ipcRenderer } = require('electron');

const terminal = document.getElementById('terminal');

function appendLog(message: string, type: string = 'info') {
  if (!terminal) return;
  const logLine = document.createElement('div');
  logLine.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;

  if (type === 'error') {
    logLine.style.color = '#f48771';
  } else if (type === 'success') {
    logLine.style.color = '#89d185';
  } else if (type === 'command') {
    logLine.style.color = '#569cd6';
    logLine.style.fontWeight = 'bold';
  }

  terminal.appendChild(logLine);
  terminal.scrollTop = terminal.scrollHeight;
}

function appendConfirmation(commandId: string, command: string) {
  if (!terminal) return;
  const box = document.createElement('div');
  box.className = 'confirmation-box';
  box.id = `confirm-${commandId}`;

  const text = document.createElement('div');
  text.textContent = `Pending execution: ${command}`;
  box.appendChild(text);

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-confirm';
  confirmBtn.textContent = 'Confirm';
  confirmBtn.onclick = () => {
    ipcRenderer.send('confirm-exec', { commandId, command, confirmed: true });
    box.remove();
    appendLog(`Execution confirmed: ${command}`, 'info');
  };

  const rejectBtn = document.createElement('button');
  rejectBtn.className = 'btn btn-reject';
  rejectBtn.textContent = 'Reject';
  rejectBtn.onclick = () => {
    ipcRenderer.send('confirm-exec', { commandId, command, confirmed: false });
    box.remove();
    appendLog(`Execution rejected: ${command}`, 'error');
  };

  box.appendChild(confirmBtn);
  box.appendChild(rejectBtn);

  terminal.appendChild(box);
  terminal.scrollTop = terminal.scrollHeight;
}

ipcRenderer.on('log-message', (event: any, { message, type }: { message: string, type: string }) => {
  appendLog(message, type);
});

ipcRenderer.on('request-confirmation', (event: any, { commandId, command }: { commandId: string, command: string }) => {
  appendConfirmation(commandId, command);
});

const btnReadFile = document.getElementById('btn-read-file');
if (btnReadFile) {
  btnReadFile.addEventListener('click', () => {
    ipcRenderer.send('request-read-file');
  });
}
