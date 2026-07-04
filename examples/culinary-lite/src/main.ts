import { defineRouter, registerOutlet } from 'uidetox';
// Dotted-module refs are resolved by the uidetox Vite plugin via detox.toml.
import Login from 'pages.Login';
import Dashboard from 'pages.Dashboard';

const routes = [
  { path: '/login', handler: Login, paramsSchema: {}, priority: 50, guards: [], status: null, meta: {} },
  { path: '/', handler: Dashboard, paramsSchema: {}, priority: 50, guards: [], status: null, meta: {} },
];

registerOutlet();
const router = defineRouter({ routes });
(document.querySelector('router-outlet') as HTMLElement & { __attach(r: unknown): void }).__attach(router);
router.start();
