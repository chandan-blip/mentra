// Idempotent DB seed. Each module contributes its own seeder.
// Run with: pnpm --filter @mentra/api db:seed
import { db } from '../src/db.js';
import { logger } from '../src/logger.js';
import { seedAccess } from '../src/modules/access/seed/access.seed.js';
import { seedFeatures } from '../src/modules/access/seed/feature.seed.js';

async function main(): Promise<void> {
  await seedAccess();
  await seedFeatures();
  logger.info('seed complete');
}

main()
  .then(() => db.end())
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    logger.error({ err }, 'seed failed');
    void db.end();
    process.exit(1);
  });
