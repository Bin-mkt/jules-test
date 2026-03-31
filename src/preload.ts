import { contextBridge, ipcRenderer } from 'electron';

// Expose API to the injected page if needed, but primarily we will
// observe the DOM directly in the preload script.

contextBridge.exposeInMainWorld('bileaAPI', {
  sendLocalExec: (command: string) => ipcRenderer.send('local-exec', command)
});

let processedCommands = new Set<string>();

async function monitorDOM() {
  const config = await ipcRenderer.invoke('get-config');
  if (!config) return;

  const currentHostname = window.location.hostname;

  let currentPlatform: any = null;

  for (const platformKey of Object.keys(config.platforms)) {
    const platform = (config.platforms as any)[platformKey];
    if (platform.hostnames.some((host: string) => currentHostname.includes(host))) {
      currentPlatform = platform;
      break;
    }
  }

  if (!currentPlatform) return;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        const assistantMessages = document.querySelectorAll(currentPlatform.assistantMessageSelector);

        if (assistantMessages.length === 0) continue;

        const latestMessage = assistantMessages[assistantMessages.length - 1];
        const textContent = latestMessage.textContent || '';

        // Looking for triggers like LOCAL_EXEC
        const regex = /LOCAL_EXEC:\s*```(?:bash|sh|cmd)?\s*([\s\S]*?)```/g;
        let match;

        while ((match = regex.exec(textContent)) !== null) {
          if (match[1]) {
            const command = match[1].trim();
            if (!processedCommands.has(command)) {
              processedCommands.add(command);
              console.log(`Sending command for execution: ${command}`);
              ipcRenderer.send('local-exec', command);
            }
          }
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

window.addEventListener('load', monitorDOM);
