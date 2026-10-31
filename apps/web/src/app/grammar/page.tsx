import { CefrLevelSchema, ListGrammarTopicsResponseSchema } from '@lingoup/contracts';
import type { Metadata } from 'next';
import { GrammarCatalog } from '@/components/grammar/grammar-catalog';
import { t } from '@/i18n';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: t.grammar.title };

export default async function GrammarPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const requested = CefrLevelSchema.safeParse((await searchParams).level);
  const level = requested.success ? requested.data : undefined;
  const { items } = await serverApi(
    `/v1/grammar/topics${level ? `?level=${level}` : ''}`,
    ListGrammarTopicsResponseSchema,
    { withSession: true },
  );

  return <GrammarCatalog key={level ?? 'all'} topics={items} level={level} />;
}
