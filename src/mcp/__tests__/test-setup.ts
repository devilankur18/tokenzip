import { setupBenchRepo } from '../../utils/test/bench-setup.js';

let memoizedSetup: any = null;

export async function setupIntegrationTest() {
  if (memoizedSetup) return memoizedSetup;
  memoizedSetup = await setupBenchRepo();
  return memoizedSetup;
}
