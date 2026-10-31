/** 语雀接入源的两级同步选择：知识库 + 文章（docs 为空表示整库）。 */
export interface SelectedDoc {
  slug: string;
  title: string;
}

export interface SelectedBook {
  book: string;
  name: string;
  docs: SelectedDoc[];
}

/** 读取 scope 里已保存的同步选择；老配置只有单个 book，按「整库」补成一条。 */
export function readSelection(scope: Record<string, unknown> | undefined): SelectedBook[] {
  const raw = scope?.selection;
  if (Array.isArray(raw)) {
    return raw.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }
      const entry = item as { book?: unknown; name?: unknown; docs?: unknown };
      const book = typeof entry.book === 'string' ? entry.book.trim() : '';
      if (!book) {
        return [];
      }
      const docs = Array.isArray(entry.docs)
        ? entry.docs.flatMap((doc) => {
            if (!doc || typeof doc !== 'object') {
              return [];
            }
            const docEntry = doc as { slug?: unknown; title?: unknown };
            const slug = typeof docEntry.slug === 'string' ? docEntry.slug.trim() : '';
            if (!slug) {
              return [];
            }
            return [{ slug, title: typeof docEntry.title === 'string' ? docEntry.title : slug }];
          })
        : [];
      return [
        {
          book,
          name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : book,
          docs,
        },
      ];
    });
  }
  const legacyBook = typeof scope?.book === 'string' ? scope.book.trim() : '';
  if (!legacyBook) {
    return [];
  }
  const namespace = typeof scope?.namespace === 'string' ? scope.namespace.trim() : '';
  const book = legacyBook.includes('/') || !namespace ? legacyBook : `${namespace}/${legacyBook}`;
  return [{ book, name: legacyBook, docs: [] }];
}
