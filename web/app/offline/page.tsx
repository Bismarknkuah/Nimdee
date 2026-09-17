export default function Offline() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-600">
        This page isn&apos;t available offline. Attendance you already marked is saved on this device and will sync when
        you reconnect.
      </p>
      <a href="/school/attendance" className="btn-primary mt-6">
        Open attendance
      </a>
    </div>
  );
}
