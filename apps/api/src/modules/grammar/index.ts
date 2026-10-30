// Public API of the Grammar module. Other modules import only from this file.
export { GrammarModule } from './grammar.module.js';
export { GrammarService } from './application/grammar.service.js';
export { GrammarImporter, type GrammarImportReport } from './infrastructure/grammar-importer.js';
