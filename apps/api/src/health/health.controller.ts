import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.module';

type CheckStatus = 'up' | 'down';

@ApiTags('health')
@SkipThrottle()
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness/readiness: checks PostgreSQL and Redis' })
  async check(@Res({ passthrough: true }) res: Response) {
    const [database, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    const status = database === 'up' && redis === 'up' ? 'ok' : 'degraded';
    if (status !== 'ok') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status, checks: { database, redis }, timestamp: new Date().toISOString() };
  }

  private async checkDb(): Promise<CheckStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<CheckStatus> {
    try {
      return (await this.redis.ping()) ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
