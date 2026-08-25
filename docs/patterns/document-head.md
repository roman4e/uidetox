# Pattern: document head / SEO

`ui-detox` provides a lifecycle-bound document-head manager with
react-helmet-async semantics: multiple components may declare head fields, the
**last mounted** entry that sets a field wins, and unmounting reverts to the
previous winner. Values may be functions, so they can read `t()` and re-apply on
locale change.

```ts
import { head, syncDocumentLang } from 'ui-detox';
import { getLocale, t } from 'ui-detox/i18n';
```

## Per-route head

Call `head()` during a component's boot (`script`). It auto-cleans on unmount.

```ts
head({
  title: () => t('home.seoTitle'),          // reactive: re-applies on locale switch
  meta: () => [
    { name: 'description', content: t('home.seoDescription') },
    { name: 'keywords',    content: t('home.seoKeywords') },
    { property: 'og:title', content: t('home.seoTitle') },
    { property: 'og:type',  content: 'website' },
  ],
});
```

- `title` → `document.title`.
- `meta` → managed `<meta>` tags (tagged `data-uid-head`); stale tags are removed
  on update/unmount.
- `lang` → `<html lang>` (or use `syncDocumentLang`, below).

Static values work too: `head({ title: 'ApiKraft' })`.

### Last-write-wins

```ts
head({ title: 'ApiKraft' });        // app shell (mounted first)
head({ title: 'Pricing — ApiKraft' }); // route (mounted later) wins
// route unmounts → title reverts to 'ApiKraft'
```

## Reactive `<html lang>`

Mirror the active locale onto the root element once, at the app root:

```ts
syncDocumentLang(getLocale);   // <html lang> tracks setLocale()
```

Returns a disposer. Equivalent to `head({ lang: getLocale })` but standalone
(no component boot required).

## Notes

- Client-side reactive head is the MVP. SSR/prerender head emission is not wired
  yet; `head()` is a no-op when `document` is absent (safe under SSR).
- Localized values depend on the i18n catalog — see
  [i18n](i18n.md).
