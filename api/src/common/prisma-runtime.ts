/**
 * The Prisma runtime actually in use. Production (Railway) runs the native engine from '@prisma/client';
 * sandboxed development can run the bundled WASM engine (PRISMA_ENGINE=wasm). Decimal instances must come
 * from the same runtime as the data returned by the client, so every helper resolves it from here.
 */
export const PrismaRuntime: typeof import('@prisma/client').Prisma = (
  process.env.PRISMA_ENGINE === 'wasm' ? require('@prisma/client/wasm') : require('@prisma/client')
).Prisma;
export const Decimal = PrismaRuntime.Decimal;
export type DecimalType = import('@prisma/client').Prisma.Decimal;

/** Duck-typed check that also recognises Decimal instances created by another copy of decimal.js. */
export const isDecimal = (v: any): boolean =>
  !!v &&
  typeof v === 'object' &&
  (Decimal.isDecimal(v) ||
    (v.constructor?.name === 'Decimal' && typeof v.toFixed === 'function' && typeof v.toDecimalPlaces === 'function'));
