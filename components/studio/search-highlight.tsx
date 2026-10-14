import { Fragment } from 'react';
import { highlightedSearchParts } from '@/lib/interaction-feedback';

export function SearchHighlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightedSearchParts(text, query).map((part, index) =>
        part.match ? (
          <mark className="tool-search-match" key={index}>
            {part.text}
          </mark>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}
