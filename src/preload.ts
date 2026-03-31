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

        // Find blocks containing the trigger within this message
        // This is robust against HTML rendering by the AI site
        const walker = document.createTreeWalker(latestMessage, NodeFilter.SHOW_TEXT, null);
        let node;
        let fullText = '';
        while ((node = walker.nextNode())) {
           fullText += node.nodeValue + '\n';
        }

        // Many web chat platforms render markdown as HTML elements (like <pre><code>)
        // so we just check for 'LOCAL_EXEC' and then grab the adjacent code blocks.
        if (latestMessage.textContent?.includes('LOCAL_EXEC')) {
           const codeBlocks = (latestMessage as Element).querySelectorAll('pre code, code');
           for (let i = 0; i < codeBlocks.length; i++) {
              const command = codeBlocks[i].textContent?.trim();
              if (command && !processedCommands.has(command)) {
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
