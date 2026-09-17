import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { isDecimal } from '../prisma-runtime';
import { Observable, map } from 'rxjs';

function serialize(value: any, depth = 0): any {
  if (value === null || value === undefined || depth > 12) return value;
  if (isDecimal(value)) return Number(value);
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map((v) => serialize(v, depth + 1));
  if (typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'passwordHash' || k === 'tokenHash' || k === 'paystackSecretKey') continue;
      out[k] = serialize(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Converts Prisma Decimal → number and strips secrets from every JSON response. */
@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => serialize(data)));
  }
}
