import { Controller, Get, INestApplication, Module, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

@Controller({ path: 'test-errors', version: '1' })
class ErrorsController {
  @Get('not-found')
  notFound() {
    throw new NotFoundException('Nothing here');
  }

  @Get('boom')
  boom() {
    throw new Error('secret internal detail');
  }
}

@Module({ controllers: [ErrorsController] })
class ErrorsTestModule {}

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule, ErrorsTestModule] }).compile();
    app = setupApp(moduleRef.createNestApplication({ logger: false }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health reports database and redis up inside the data envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.data).toMatchObject({ status: 'ok', checks: { database: 'up', redis: 'up' } });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns the error envelope for HttpExceptions', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/test-errors/not-found').expect(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Nothing here', requestId: expect.any(String) },
    });
  });

  it('hides internal error details', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/test-errors/boom').expect(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
  });

  it('returns 404 envelope for unknown routes', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('serves the OpenAPI document', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(res.body.paths).toHaveProperty('/api/v1/health');
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
