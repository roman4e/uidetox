---
name: Home
tag: page-home
extends: [PageTitle, PageMetadata]
title: "UIDetox Showcase"
meta:
  description: "End-to-end showcase of every phase"
---

# Welcome to UIDetox

HTML-first Web Components framework — showcase.

```ts props
export type Props = { user: string };
```

```html template
<main class="home">
  <h1>Hello, ${props.user}!</h1>
  <input use="uppercase" placeholder="type…" />
  <if when=${true}>
    <p>All phases integrated:</p>
    <ul>
      <li>Phase 0 — runtime + templates</li>
      <li>Phase 1a — testing</li>
      <li>Phase 1c — DSL</li>
      <li>Phase 2a — include/lazy-load</li>
      <li>Phase 2b — routing</li>
      <li>Phase 2c — SSR/hydrate</li>
      <li>Phase 2d — inheritance/off/C3</li>
      <li>Phase 2e — component DSL</li>
    </ul>
  </if>
</main>
```

```ts script
// no dynamic behaviour in showcase
```

```css style
.home { padding: 2rem; max-width: 60rem; margin: 0 auto; }
```

```html example:basic
<page-home user="World"></page-home>
```
