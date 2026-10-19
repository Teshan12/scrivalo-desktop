// Nothing from the desktop shell is exposed to the page except a flag saying it is the desktop app.
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('scrivaloDesktop', { platform: process.platform });
