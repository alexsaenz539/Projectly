const fs = require('node:fs/promises');

function createReleaseNotes({ version, enabled, file, notes, storage = fs }) {
  return {
    async pending() {
      if (!enabled) return null;
      let seen;
      try {
        seen = JSON.parse(await storage.readFile(file, 'utf8')).version;
      } catch (error) {
        if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      }
      if (seen === version) return null;
      const changes = notes[version];
      return {
        version,
        changes:
          Array.isArray(changes) && changes.length
            ? changes
            : ['Esta versión incluye mejoras y correcciones. No se han incluido notas detalladas.'],
      };
    },
    async acknowledge() {
      if (!enabled) return;
      const temporary = file + '.tmp';
      await storage.writeFile(temporary, JSON.stringify({ version }), 'utf8');
      await storage.rename(temporary, file);
    },
  };
}
module.exports = { createReleaseNotes };
