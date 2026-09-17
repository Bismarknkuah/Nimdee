import { AppShell } from '@/components/layout/AppShell';
export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  return <AppShell mode="school">{children}</AppShell>;
}
