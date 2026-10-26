import { Injectable } from '@nestjs/common';
import type { VocabularyStats } from '@lingoup/contracts';
import { CARD_STATES } from '@lingoup/learning-engine';
import { VocabularyRepository } from '../infrastructure/vocabulary.repository.js';

/** Public read API of the Vocabulary module (used by Progress). */
@Injectable()
export class VocabularyStatsQuery {
  constructor(private readonly repository: VocabularyRepository) {}

  async forUser(userId: string, now = new Date()): Promise<VocabularyStats> {
    const { byState, dueNow, totalReviews } = await this.repository.stats(userId, now);
    const counts = Object.fromEntries(
      CARD_STATES.map((state) => [state, 0]),
    ) as VocabularyStats['byState'];
    for (const row of byState) {
      if (row.state in counts) counts[row.state as keyof typeof counts] = row.value;
    }
    return {
      total: Object.values(counts).reduce((sum, value) => sum + value, 0),
      dueNow,
      byState: counts,
      totalReviews,
    };
  }
}
