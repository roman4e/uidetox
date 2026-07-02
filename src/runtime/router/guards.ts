import { Redirect, type Guard, type NavigationContext } from './types.js';

export async function runGuards(
  chain: Guard[],
  ctx: NavigationContext,
): Promise<true | false | Redirect> {
  for (const guard of chain) {
    const result = await guard(ctx);
    if (result instanceof Redirect) return result;
    if (result === false) return false;
  }
  return true;
}
