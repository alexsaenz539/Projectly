const path = require('node:path');
function resolveAsset(root, url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'projectos:' || parsed.host !== 'app') return null;
  let requested;
  try {
    requested = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
  if (requested.includes('\\') || requested.includes('\0') || requested.split('/').includes('..'))
    return null;
  const relative = requested.replace(/^\/+/, '');
  const file = path.resolve(root, relative || 'index.html');
  const fromRoot = path.relative(root, file);
  if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) return null;
  return path.extname(file) ? file : path.join(root, 'index.html');
}
function trustedSender(event, window, developmentOrigin) {
  if (
    !window ||
    window.isDestroyed() ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame
  )
    return false;
  try {
    const url = new URL(event.senderFrame.url);
    return developmentOrigin
      ? url.origin === developmentOrigin
      : url.protocol === 'projectos:' && url.host === 'app';
  } catch {
    return false;
  }
}
module.exports = { resolveAsset, trustedSender };
