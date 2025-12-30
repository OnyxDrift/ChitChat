/**
 * ChitChat - Electron Ollama Chat Client
 *
 * Copyright (c) 2025 David Smith (OnyxDrift)
 * Licensed under the MIT License
 * https://github.com/OnyxDrift/ChitChat
 */

const { contextBridge } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    // Future: Add IPC methods here for backend connectivity
    // Example: sendMessage: (message) => ipcRenderer.invoke('send-message', message)
  }
);
