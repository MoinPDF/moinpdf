import { retainPageEdits, type ProjectState, type ProjectSource } from './local-projects';

export type ProjectCheckpoint = {
  projectId: string;
  content: string;
  sources: { metadata: string; bytes: Uint8Array; invoiceBytes?: Uint8Array }[];
};

export function projectContentSignature(
  name: string,
  state: Pick<ProjectState, 'pages' | 'edits' | 'options' | 'documentSessions' | 'toolDrafts'>,
) {
  return JSON.stringify({
    name: name.trim(),
    pages: state.pages,
    edits: retainPageEdits(state.edits, state.pages),
    options: state.options,
    toolDrafts: state.toolDrafts,
    documents: Object.fromEntries(
      Object.entries(state.documentSessions)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, session]) => [id, session.current]),
    ),
  });
}

function sourceCheckpoint(source: ProjectSource) {
  return {
    metadata: JSON.stringify([
      source.id,
      source.name,
      source.kind,
      source.size,
      source.wasEncrypted,
      source.invoiceOriginal?.name,
    ]),
    // Source buffers are immutable for the lifetime of an opened source. Keep
    // identity, not copies or repeated hashing of up to 80 MB on every edit.
    bytes: source.bytes,
    invoiceBytes: source.invoiceOriginal?.bytes,
  };
}

export function captureProjectCheckpoint(
  projectId: string,
  name: string,
  sources: ProjectSource[],
  state: ProjectState,
): ProjectCheckpoint {
  return {
    projectId,
    content: projectContentSignature(name, state),
    sources: sources.map(sourceCheckpoint),
  };
}

export function matchesProjectCheckpoint(
  checkpoint: ProjectCheckpoint | null,
  projectId: string | undefined,
  sources: ProjectSource[],
  content: string,
) {
  return Boolean(
    checkpoint &&
    checkpoint.projectId === projectId &&
    checkpoint.content === content &&
    checkpoint.sources.length === sources.length &&
    sources.every((source, index) => {
      const saved = checkpoint.sources[index],
        current = sourceCheckpoint(source);
      return (
        saved.metadata === current.metadata &&
        saved.bytes === current.bytes &&
        saved.invoiceBytes === current.invoiceBytes
      );
    }),
  );
}
