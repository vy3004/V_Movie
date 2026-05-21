type SourceRef = { source?: string; slug?: string } & object;

type BuildMergedMoviePatchInput = {
  fieldValues: Record<string, unknown>;
  sourceGroups: SourceRef[][];
};

export function mergeSourceRefs(sourceGroups: SourceRef[][]): SourceRef[] {
  const byKey = new Map<string, SourceRef>();

  for (const group of sourceGroups) {
    for (const source of group) {
      if (!source.source || !source.slug) continue;
      byKey.set(`${source.source}:${source.slug}`, source);
    }
  }

  return Array.from(byKey.values());
}

export function buildMergedMoviePatch(input: BuildMergedMoviePatchInput) {
  return {
    ...input.fieldValues,
    sources: mergeSourceRefs(input.sourceGroups),
    merge_status: "merged",
    is_blocked: false,
    last_synced_at: new Date().toISOString(),
  };
}
