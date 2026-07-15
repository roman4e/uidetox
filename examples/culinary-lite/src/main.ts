import { defineRouter, registerOutlet } from 'ui-detox';
// Dotted-module refs are resolved by the uidetox Vite plugin via detox.toml.
// `routes` compiles from routes.dtx (the `router` verb) to a RouteEntry[] default export.
import routes from 'routes';

registerOutlet();
const router = defineRouter({ routes, mode: 'history' });
(document.querySelector('router-outlet') as HTMLElement & { __attach(r: unknown): void }).__attach(router);
router.start();
