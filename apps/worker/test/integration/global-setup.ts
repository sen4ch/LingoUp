import { requireTestDatabaseUrl, resetTestDatabase } from '@lingoup/database/testing';

export default async function setup(): Promise<void> {
  await resetTestDatabase(requireTestDatabaseUrl());
}
