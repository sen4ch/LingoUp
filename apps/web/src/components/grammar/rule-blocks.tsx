import type { GrammarBlock, TextSpan } from '@lingoup/contracts';

/** Renders structured rule text as React elements; there is no HTML to sanitize. */
function Spans({ spans }: { spans: TextSpan[] }) {
  return (
    <>
      {spans.map((span, index) =>
        span.strong ? (
          <strong key={index}>{span.text}</strong>
        ) : (
          <span key={index}>{span.text}</span>
        ),
      )}
    </>
  );
}

export function RuleBlocks({ blocks }: { blocks: GrammarBlock[] }) {
  return (
    <div className="flex flex-col gap-4 leading-relaxed">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <h2 key={index} className="mt-2 text-xl font-semibold">
                {block.text}
              </h2>
            );
          case 'paragraph':
            return (
              <p key={index}>
                <Spans spans={block.spans} />
              </p>
            );
          case 'list':
            return (
              <ul key={index} className="list-disc space-y-1 pl-6">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Spans spans={item} />
                  </li>
                ))}
              </ul>
            );
          case 'example':
            return (
              <p
                key={index}
                className="border-l-4 border-primary/50 bg-surface-muted px-4 py-2 font-reading italic"
              >
                <Spans spans={block.spans} />
              </p>
            );
        }
      })}
    </div>
  );
}
