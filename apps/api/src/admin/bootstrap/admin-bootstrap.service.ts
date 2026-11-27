import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PasswordService, checkPasswordPolicy } from '../../auth/password.service';
import { AuditService } from '../../common/audit.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';

export type BootstrapResult = 'created' | 'not_configured' | 'staff_exists' | 'email_in_use' | 'weak_password' | 'error';

/**
 * Creates the first back-office administrator from `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` when (and only
 * when) no staff account exists yet. The account is a SUPER_ADMIN that must change its password at first login.
 * The password is never logged, audited or returned.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger('AdminBootstrap');

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.run();
  }

  async run(): Promise<BootstrapResult> {
    const email = this.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    const password = this.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (!email || !password) return 'not_configured';
    try {
      if ((await this.prisma.user.count({ where: { isStaff: true } })) > 0) return 'staff_exists';
      if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
        this.logger.warn(`Bootstrap skipped: ${email} already exists as a non-staff account (refusing to promote it automatically)`);
        return 'email_in_use';
      }
      const problems = checkPasswordPolicy(password, { email });
      if (problems.length) {
        this.logger.warn(`Bootstrap skipped: ADMIN_BOOTSTRAP_PASSWORD does not meet the password policy (${problems.join(', ')})`);
        return 'weak_password';
      }
      const passwordHash = await this.passwords.hash(password);
      const user = await this.prisma.user.create({
        data: { email, fullName: 'Administrateur', isStaff: true, staffRole: 'SUPER_ADMIN', passwordHash, mustChangePassword: true },
      });
      await this.audit.record({ actorId: null }, { action: 'admin.bootstrap', entityType: 'User', entityId: user.id, metadata: { email } });
      this.logger.log(`Bootstrap administrator created: ${email} (SUPER_ADMIN, password change required at first login)`);
      return 'created';
    } catch (e) {
      // Never crash the API for this (e.g. two instances starting together: the unique e-mail wins) and never print env values.
      this.logger.error(`Bootstrap failed: ${e instanceof Error ? e.name : 'unknown error'}`);
      return 'error';
    }
  }
}
