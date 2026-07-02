---
name: AppRoutes
---

```ts script
import Home from './pages/Home.md';
import UsersList from './pages/UsersList.md';
import UserProfile from './pages/UserProfile.md';
import NotFound from './pages/NotFound.md';
```

```html template
<Router slashPolicy="narrowing">
  <Route path="/" to="${Home}"/>
  <Route path="/users/" to="${UsersList}"/>
  <Route path="/users/:id" to="${UserProfile}">
    <param :id="number"/>
  </Route>
  <Route path="**" to="${NotFound}" status="404"/>
</Router>
```
