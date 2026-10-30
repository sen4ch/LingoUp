import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '@lingoup/database';
import type { z } from 'zod';
import type { SkillSchema } from '@lingoup/contracts/events';
import { DATABASE, OutboxWriter } from '../../../platform/index.js';

@Injectable()
export class PracticeEvents {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly outbox: OutboxWriter,
  ) {}
  async complete(userId: string, skill: z.infer<typeof SkillSchema>, sourceKey: string) {
    await this.db.transaction((tx) =>
      this.outbox.append(tx, {
        type: 'PracticeCompleted',
        version: 1,
        userId,
        payload: { skill, sourceKey },
      }),
    );
  }
  dailyKey(kind: string, content: string, now = new Date()) {
    return `${kind}:${now.toISOString().slice(0, 10)}:${createHash('sha256').update(content).digest('hex')}`;
  }
}
