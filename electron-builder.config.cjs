const publish = require('./electron/updates.config.json');
module.exports = {
  appId: 'com.alexsaenz.projectly',
  productName: 'Projectly',
  asar: true,
  directories: { output: 'release' },
  files: ['dist/project-os/browser/**/*', 'electron/**/*', 'package.json'],
  win: {
    icon: 'public/brand/app-icon-1024x1024.png',
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    createDesktopShortcut: true,
    deleteAppDataOnUninstall: false,
  },
  artifactName: 'Projectly-Setup-${version}-${arch}.${ext}',
  publish,
};
