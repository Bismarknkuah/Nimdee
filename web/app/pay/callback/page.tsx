'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui';

function Callback() {
  const params = useSearchParams();
  const ref = params.get('reference') || params.get('trxref');
  const [state, setState] = useState<any>(null);
  useEffect(() => {
    if (!ref) return;
    api
      .get(`/portal/payments/verify/${encodeURIComponent(ref)}`)
      .catch(() => api.get(`/fees/payments/online/verify/${encodeURIComponent(ref)}`))
      .then(setState)
      .catch((e) => setState({ status: 'ERROR', message: e.message }));
  }, [ref]);
  if (!ref) return <p>Missing payment reference.</p>;
  if (!state) return <Spinner />;
  return (
    <div className="text-center">
      <h1 className="text-xl font-semibold">
        {state.status === 'SUCCESS'
          ? 'Payment confirmed'
          : state.status === 'PENDING'
            ? 'Payment pending'
            : 'Payment not completed'}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {state.status === 'SUCCESS'
          ? `Receipt ${state.payment?.receiptNumber ?? ''} has been issued.`
          : (state.message ?? 'We will update the status as soon as the bank confirms.')}
      </p>
      <Link href="/school" className="btn-primary mt-6">
        Back to portal
      </Link>
    </div>
  );
}
export default function PayCallback() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-md p-8">
        <Suspense>
          <Callback />
        </Suspense>
      </div>
    </div>
  );
}
