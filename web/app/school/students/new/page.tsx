'use client';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAcademic } from '@/lib/academic';
import { StudentForm } from '@/components/StudentForm';
import { Card, PageHeader, useToast } from '@/components/ui';

export default function NewStudent() {
  const router = useRouter();
  const toast = useToast();
  const { classes } = useAcademic();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Enrol a student"
        subtitle="A student ID is generated automatically"
        back={() => router.back()}
      />
      <Card>
        <StudentForm
          classes={classes}
          withGuardian
          submitLabel="Enrol student"
          onSubmit={async (body) => {
            try {
              const s = await api.post('/students', body);
              toast.success(`${s.firstName} enrolled as ${s.studentId}`);
              router.replace(`/school/students/${s.id}`);
            } catch (e: any) {
              toast.error(e.code === 'PLAN_LIMIT_REACHED' ? e.message : e.message);
            }
          }}
        />
      </Card>
    </div>
  );
}
