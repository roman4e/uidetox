---
name: App
tag: app-root
---

# App

Root of the hello example.

```ts props
export type Props = { who: string };
```

```html template
<section class="hello">
  <h1>Hello, ${props.who}!</h1>
  <if when="${s.open}">
    <p>The panel is open.</p>
    <else><p>The panel is closed.</p></else>
  </if>
  <button @click="${toggle}">Toggle</button>
</section>
```

```ts script
const s = state({ open: true });
function toggle() { s.open = !s.open; }
```
