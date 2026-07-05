import { Redirect } from 'uidetox';
import type { NavigationContext } from 'uidetox';

// A route guard: allow through when authenticated, else redirect to /login.
export default function requireAuth(_ctx: NavigationContext): boolean | Redirect {
  const authed = typeof localStorage !== 'undefined' && !!localStorage.getItem('token');
  return authed ? true : new Redirect('/login');
}
