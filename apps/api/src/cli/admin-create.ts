/**
 * Creates a back-office account from the command line.
 *
 *   pnpm --filter @impact-pro/api admin:create -- --email you@example.com --name "Full Name" [--role SUPER_ADMIN]
 *
 * The password is read from a hidden prompt (or from the ADMIN_CREATE_PASSWORD env var for automation) — never from argv,
 * so it does not end up in shell history or process listings. The account must change its password at first login.
 */
import { Algorithm, hash } from '@node-rs/argon2';
import { PrismaClient, StaffRole } from '@prisma/client';
import { checkPasswordPolicy } from '../auth/password.service';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error('No terminal available for the hidden password prompt (set ADMIN_CREATE_PASSWORD instead)'));
      return;
    }
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (c === '\u0003') {
          stdin.setRawMode(false);
          process.stdout.write('\n');
          reject(new Error('Cancelled'));
          return;
        }
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  const email = arg('email')?.trim().toLowerCase();
  const fullName = arg('name')?.trim();
  const role = (arg('role') ?? 'SUPER_ADMIN') as StaffRole;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('--email is required and must be a valid e-mail address');
  if (!fullName || fullName.length < 2) throw new Error('--name is required (at least 2 characters)');
  if (!Object.values(StaffRole).includes(role)) throw new Error(`--role must be one of: ${Object.values(StaffRole).join(', ')}`);

  const password = process.env.ADMIN_CREATE_PASSWORD ?? (await promptHidden('Password (min 12 characters): '));
  const problems = checkPasswordPolicy(password, { email });
  if (problems.length) throw new Error(`Password rejected: ${problems.join(', ')}`);
  if (!process.env.ADMIN_CREATE_PASSWORD && (await promptHidden('Repeat password: ')) !== password) throw new Error('Passwords do not match');

  const prisma = new PrismaClient();
  try {
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new Error('An account with this e-mail already exists');
    const memoryCost = Number(process.env.ARGON2_MEMORY_KIB ?? 19456);
    const timeCost = Number(process.env.ARGON2_TIME_COST ?? 2);
    const passwordHash = await hash(password, { algorithm: Algorithm.Argon2id, memoryCost, timeCost, parallelism: 1 });
    const user = await prisma.user.create({
      data: { email, fullName, isStaff: true, staffRole: role, passwordHash, mustChangePassword: true },
    });
    await prisma.auditLog.create({
      data: { action: 'admin.cli_create', entityType: 'User', entityId: user.id, metadata: { email, role } },
    });
    console.log(`Created ${role} ${email}. The password must be changed at first login.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : 'Failed');
  process.exitCode = 1;
});
