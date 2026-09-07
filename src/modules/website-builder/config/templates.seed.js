/**
 * Template catalog: source of truth is the folder tree
 *   templates/ristoranti/<slug>/template.json
 *   templates/hotel/<slug>/template.json
 *   templates/servizi/<slug>/template.json
 *   templates/generico/<slug>/template.json
 *
 * This module re-exports that catalog so existing require() paths keep working.
 */

const { loadTemplatesFromFolders } = require('../templates/load-from-folders');

const TEMPLATES = loadTemplatesFromFolders();

module.exports = { TEMPLATES };
