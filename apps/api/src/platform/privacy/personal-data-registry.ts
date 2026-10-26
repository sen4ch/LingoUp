import { Injectable } from '@nestjs/common';

/** A module that stores personal data contributes its section to the user's data export. */
export interface PersonalDataExporter {
  readonly section: string;
  exportUserData(userId: string): Promise<unknown>;
}

/**
 * Inversion point for GDPR-style data export: modules register exporters on init, so the
 * Identity module can build a complete export without depending on every other module.
 * Deletion is handled by `ON DELETE CASCADE` from identity.users (see ADR-0003).
 */
@Injectable()
export class PersonalDataRegistry {
  private readonly exporters = new Map<string, PersonalDataExporter>();

  register(exporter: PersonalDataExporter): void {
    if (this.exporters.has(exporter.section)) {
      throw new Error(`Personal data section "${exporter.section}" is already registered`);
    }
    this.exporters.set(exporter.section, exporter);
  }

  async exportAll(userId: string): Promise<Record<string, unknown>> {
    const sections: Record<string, unknown> = {};
    for (const [section, exporter] of this.exporters) {
      sections[section] = await exporter.exportUserData(userId);
    }
    return sections;
  }
}
