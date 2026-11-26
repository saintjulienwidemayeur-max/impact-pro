import { execSync } from 'node:child_process';
import { join } from 'node:path';

/** Applies all migrations to the test database before the suite runs. */
export default function globalSetup(): void {
  const url =
    process.env.TEST_DATABASE_URL ?? 'postgresql://impact:impact_dev@localhost:5432/impact_pro_test?schema=public';
  execSync('pnpm exec prisma migrate deploy', {
    cwd: join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
