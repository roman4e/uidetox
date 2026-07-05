---
name: Counter
tag: app-counter
---

# Counter

A component with colocated tests, fixtures, and a mock — dev/build strip these;
`mode: 'test'` re-emits them so the runner can execute `__tests`.

```html template
<div class="counter">
  <button #dec>-</button>
  <span class="value">${s.count}</span>
  <button #inc>+</button>
</div>
```

```ts script
const s = state({ count: 0 });
function inc() { s.count++; }
function dec() { s.count--; }
```

```json fixtures
{ "start": 0, "step": 1 }
```

```ts test
it('starts at zero', () => {
  const el = document.createElement('app-counter');
  document.body.appendChild(el);
  expect(el.querySelector('.value')?.textContent).toBe('0');
  el.remove();
});
```
