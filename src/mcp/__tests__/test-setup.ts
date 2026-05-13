import { setupBenchRepo } from '../../utils/test/bench-setup.js';

export async function setupIntegrationTest() {
  return await setupBenchRepo();
}
