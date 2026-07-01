---
name: Todo
tag: app-todo
---

# Todo

Displays a single todo item with checkbox and text.

```ts props
export type Props = { id: string; title: string; done: boolean };
```

```html template
<div class="todo" data-done=${props.done}>
  <span>${props.title}</span>
</div>
```

```ts script
// no dynamic behaviour in this example
```

```json fixtures
{ "default": { "id": "1", "title": "Buy milk", "done": false } }
```

```ts mock
// no external deps to mock
```

```ts test
it('renders the title', async () => {
  document.body.innerHTML = '<app-todo id="1" title="Buy milk" done="false"></app-todo>';
  await Promise.resolve();
  flushSync();
  const el = document.body.querySelector('app-todo');
  expect(el?.querySelector('span')?.textContent).toBe('Buy milk');
});
```

```ts test:visual
document.body.innerHTML = '<app-todo id="1" title="Buy milk" done="false"></app-todo>';
await Promise.resolve();
flushSync();
await snapshot('default');
```

```ts test:a11y
document.body.innerHTML = '<main><app-todo id="1" title="Buy milk" done="false"></app-todo></main>';
await Promise.resolve();
flushSync();
expect(await axe(document.body)).toHaveNoViolations();
```
