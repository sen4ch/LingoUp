import { CEFR_LEVELS, type CefrLevel } from '@lingoup/contracts';
import { cn } from '@lingoup/ui';
import Link from 'next/link';
import { t } from '@/i18n';

/** CEFR level chips linking to `basePath?level=…`; "all levels" clears the filter. */
export function LevelFilter({
  basePath,
  active,
}: {
  basePath: string;
  active: CefrLevel | undefined;
}) {
  const filters = [
    { value: undefined, label: t.levels.all },
    ...CEFR_LEVELS.map((value) => ({ value, label: value })),
  ];
  return (
    <nav aria-label={t.levels.filterLabel}>
      <ul className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const isActive = filter.value === active;
          return (
            <li key={filter.label}>
              <Link
                href={filter.value ? `${basePath}?level=${filter.value}` : basePath}
                aria-current={isActive ? 'page' : undefined}
                title={filter.value ? t.levels.names[filter.value] : undefined}
                className={cn(
                  'inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium',
                  isActive
                    ? 'border-primary bg-primary text-primary-fg'
                    : 'border-border bg-surface hover:bg-surface-muted',
                )}
              >
                {filter.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
