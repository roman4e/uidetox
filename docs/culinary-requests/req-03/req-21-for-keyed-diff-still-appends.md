# REQ-21 — `<for>` keyed diff still appends stale items after resource reload

**Priority:** **P0** — every list-mutation UI is broken. Archive,
Dashboard, palette, edges list — any `<for>` over a mutating array can
accumulate stale DOM rows on re-render.

**Follows:** REQ-19 fixed `<if>/<case>` **multi-element (fragment)
teardown** (verified in Culinary — inspector cycle now shows exactly one
heading), but the `<for>` **keyed-diff** side of the ticket did not
land.

## Reproduction — Culinary Archive page

Setup: 3 dishes in the archive (server-side). Load
`https://culinary.apikraft.com/archive` — DOM shows 3 rows. Click
"Розархівувати" on the first row.

- Server (verified via `GET /api/v1/dishes/?archived=true`): **2** items.
- DOM: **4** `<li class="row">` — the two remaining rows are each
  rendered twice, the unarchived row stays visible.

Template (unchanged from REQ-19):

```html
<for each=${list.data.items} item="d" key="d.id">
  <li class="row">
    <div class="info">
      <strong>${d.name_ua}</strong>
      <span class="meta">${d.category} · v${d.versions_count}</span>
    </div>
    …
  </li>
</for>
```

Action (unchanged):

```js
await api.value.dishes.unarchiveEndpoint({ path: { dish_id: id } });
list.reload();
```

`list.reload()` DOES fetch fresh data (verified in the Network panel —
new 200 response with the correct 2-item array). `list.data.items`
updates. The subscribed `<for>` re-runs — and appends without removing
old subtrees.

## Expected (per REQ-19 acceptance criteria)

- Old keys not in the new array → DOM subtrees removed.
- Shared keys → DOM identity preserved.
- New keys → mounted.
- No stale nodes remain.

## Actual

- Old keys not in the new array → **kept in DOM**.
- Shared keys → **duplicated on every re-render** (fresh subtree +
  original subtree side-by-side).
- New keys → mounted.

Effectively: `after = before + new` rather than `after = new`.

## What likely landed vs. what didn't

REQ-19's fix commit `b4a6aa5` — `fix(directives): <if>/<for>/<case>
remove multi-element (fragment) branches` — reads as though it
addressed the branch-cleanup case (an `<if>` whose child list is more
than one element). Culinary confirms that path works. What did not
change: the reactive re-diff of `<for>` when `list.data.items` mutates
(same signal, new array reference, keys overlap partially).

Suspected: the `<for>` mounter keeps its child list in a local map keyed
by `key`, but the re-run either (a) doesn't compare against the map,
just appends the fresh set, or (b) compares by array index instead of
`key`, so a shrunk array leaves the tail orphaned.

## Regression test

```ts
// Given a component:
// <for each=${state.items} item="x" key="x.id"><span>${x.name}</span></for>
mount(<Comp state={{items: [{id:1,name:'a'},{id:2,name:'b'},{id:3,name:'c'}]}} />, host);
expect(host.querySelectorAll('span').length).toBe(3);   // a, b, c

state.items = [{id:2,name:'b'},{id:3,name:'c'}];         // drop id=1
expect(host.querySelectorAll('span').length).toBe(2);   // b, c only
expect(host.querySelector('span').textContent).toBe('b');

state.items = [{id:2,name:'b'}];                         // drop id=3
expect(host.querySelectorAll('span').length).toBe(1);   // b only

state.items = [{id:4,name:'d'},{id:2,name:'b'}];         // add id=4, keep id=2
expect([...host.querySelectorAll('span')].map(s => s.textContent)).toEqual(['d','b']);
```

## Also observed — resource returns fresh data but replace path may double-emit

While debugging, the network panel showed 3 GETs for the compare
version list on a single mount. Not certain this is `reload()` +
`key()` re-evaluation racing, or the `<case>` re-mounting the `<else>`
branch. Flag for the fix author.

## Culinary side after this lands

- `<for>` verify: Archive unarchive → row disappears immediately, DOM
  count matches server exactly.
- Dashboard delete/archive → same.
- Palette + editor node list — currently rely on state mutation, not
  `resource.reload()`, but should still verify.
