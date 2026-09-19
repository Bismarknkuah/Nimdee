import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SerializeInterceptor } from './common/interceptors/serialize.interceptor';

function corsMatcher(origins: string[]) {
  return (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || origins.length === 0) return cb(null, true);
    const ok = origins.some((o) => {
      if (o === '*' || o === origin) return true;
      if (o.includes('*.')) {
        const [scheme, host] = o.split('://');
        const suffix = host.replace('*.', '');
        try {
          const u = new URL(origin);
          return u.protocol === `${scheme}:` && (u.host === suffix || u.host.endsWith(`.${suffix}`));
        } catch {
          return false;
        }
      }
      return false;
    });
    cb(ok ? null : new Error(`Origin ${origin} not allowed by CORS`), ok);
  };
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  for (const v of ['DATABASE_URL']) if (!process.env[v]) throw new Error(`Missing required environment variable ${v}`);
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET))
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in production');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, bodyParser: false });
  // Default body parser caps JSON at 100kb, which rejects an uploaded photo (sent as a base64 data
  // URL) before it reaches any controller. Raised for the whole app since it's a cheap, safe default.
  // The verify callback preserves req.rawBody exactly as NestJS's own bodyParser:true would have set
  // it — payments.service.ts's Paystack webhook signature check depends on that exact raw buffer.
  const captureRawBody = (req: any, _res: unknown, buf: Buffer) => {
    req.rawBody = buf;
  };
  app.use(express.json({ limit: '10mb', verify: captureRawBody }));
  app.use(express.urlencoded({ limit: '10mb', extended: true, verify: captureRawBody }));
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsMatcher(origins),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new SerializeInterceptor());
  app.enableShutdownHooks();

  if (process.env.SWAGGER !== 'false') {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Nimdee API')
        .setDescription('Multi-tenant school operating system')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, doc, { swaggerOptions: { persistAuthorization: true } });
  }

  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  logger.log(`Nimdee API listening on :${port}  (docs at /docs, health at /health)`);
}
bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
