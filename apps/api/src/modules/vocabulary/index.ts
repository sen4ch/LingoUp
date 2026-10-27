// Public API of the Vocabulary module. Other modules import only from this file.
export { VocabularyModule } from './vocabulary.module.js';
export { VocabularyStatsQuery } from './application/vocabulary-stats.query.js';
export { PracticeService } from './application/practice.service.js';
export { MIN_PRACTICE_WORDS, type PracticeWord } from './domain/practice.js';
