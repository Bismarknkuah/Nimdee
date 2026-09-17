import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ctx } from '../context/request-context';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: any = { message: 'Internal server error' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      body = typeof r === 'string' ? { message: r } : { ...(r as object) };
      if (Array.isArray(body.message)) {
        body.details = body.message;
        body.message = body.message[0];
      }
    } else if (typeof exception?.code === 'string' && /^P\d{4}$/.test(exception.code)) {
      // Prisma known request error (checked by shape so it works for every engine runtime)
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        const t = exception.meta?.target;
        const target = Array.isArray(t)
          ? t.filter((x: string) => x !== 'tenantId').join(', ')
          : typeof t === 'string'
            ? t
            : '';
        body = { code: 'DUPLICATE', message: `A record with the same ${target || 'value'} already exists.` };
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        body = { code: 'NOT_FOUND', message: 'Record not found.' };
      } else if (exception.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        body = { code: 'INVALID_REFERENCE', message: 'A referenced record does not exist.' };
      } else {
        this.logger.error(`Prisma ${exception.code}: ${exception.message}`);
        body = { code: exception.code, message: 'Database error' };
      }
    } else if (exception?.message?.includes('row-level security')) {
      status = HttpStatus.FORBIDDEN;
      body = { code: 'TENANT_ISOLATION', message: 'Cross-tenant access blocked.' };
    } else {
      this.logger.error(exception?.stack || exception);
    }

    res.status(status).json({
      statusCode: status,
      ...body,
      path: req.originalUrl,
      requestId: ctx().requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
