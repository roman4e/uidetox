export interface TagRegistry {
  /** Records `tag → file`; throws if the same tag is claimed by a different file. */
  register(tag: string | null, file: string): void;
  clear(): void;
}

/** Tracks custom-element tags across compiled files to enforce global uniqueness. */
export function createTagRegistry(): TagRegistry {
  const byTag = new Map<string, string>();
  return {
    register(tag, file) {
      if (!tag) return;
      const prev = byTag.get(tag);
      if (prev && prev !== file) {
        throw new Error(
          `ui-detox: duplicate custom-element tag "${tag}" — declared in both\n  ${prev}\n  ${file}\nTags must be unique across the app.`,
        );
      }
      byTag.set(tag, file);
    },
    clear() { byTag.clear(); },
  };
}
