/** Per-school rules engine. Stored as JSON on Tenant.settings and merged with these defaults. */
export interface GradeBand {
  grade: string;
  min: number;
  max: number;
  remark: string;
  points?: number;
}

export interface SchoolSettings {
  academic: {
    gradingScheme: GradeBand[];
    passMark: number;
    promotionAverage: number;
    caWeight: number;
    examWeight: number;
    resultApprovalLevels: Array<'REVIEW' | 'APPROVE'>;
    termsPerYear: number;
    levels: string[];
  };
  attendance: {
    statuses: string[];
    schoolStartTime: string;
    lateAfter: string;
    minimumAttendancePercent: number;
    schoolDays: number[];
    /** Send parents an in-app notification (and SMS when enabled) when a child is marked absent */
    notifyParentsOnAbsence: boolean;
  };
  finance: {
    invoicePrefix: string;
    receiptPrefix: string;
    allowInstallments: boolean;
    defaultInstallments: number;
    paymentGraceDays: number;
    lateFeePercent: number;
    siblingDiscountPercent: number;
    paymentProvider: 'NONE' | 'PAYSTACK';
    paystackSecretKey?: string;
    paystackPublicKey?: string;
    bankDetails?: string;
  };
  sync: { conflictPolicy: 'LATEST_WINS' | 'SERVER_WINS' | 'MANUAL'; attendanceWindowDays: number };
  canteen: {
    defaultDailyLimit: number;
    allowNegativeStock: boolean;
    /** Plan types the school offers to parents in the portal */ selfServicePlans: boolean;
  };
  communication: {
    smsSenderId?: string;
    announcementChannels: string[];
    smsEnabled: boolean;
    emailEnabled: boolean;
    feeReminderDaysBefore: number;
  };
}

export const DEFAULT_SETTINGS: SchoolSettings = {
  academic: {
    gradingScheme: [
      { grade: 'A1', min: 80, max: 100, remark: 'Excellent', points: 1 },
      { grade: 'B2', min: 70, max: 79.99, remark: 'Very Good', points: 2 },
      { grade: 'B3', min: 65, max: 69.99, remark: 'Good', points: 3 },
      { grade: 'C4', min: 60, max: 64.99, remark: 'Credit', points: 4 },
      { grade: 'C5', min: 55, max: 59.99, remark: 'Credit', points: 5 },
      { grade: 'C6', min: 50, max: 54.99, remark: 'Credit', points: 6 },
      { grade: 'D7', min: 45, max: 49.99, remark: 'Pass', points: 7 },
      { grade: 'E8', min: 40, max: 44.99, remark: 'Pass', points: 8 },
      { grade: 'F9', min: 0, max: 39.99, remark: 'Fail', points: 9 },
    ],
    passMark: 50,
    promotionAverage: 50,
    caWeight: 30,
    examWeight: 70,
    resultApprovalLevels: ['REVIEW', 'APPROVE'],
    termsPerYear: 3,
    levels: ['NURSERY', 'KG', 'PRIMARY', 'JHS', 'SHS'],
  },
  attendance: {
    statuses: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK'],
    schoolStartTime: '07:30',
    lateAfter: '08:00',
    minimumAttendancePercent: 75,
    schoolDays: [1, 2, 3, 4, 5],
    notifyParentsOnAbsence: false,
  },
  finance: {
    invoicePrefix: 'INV',
    receiptPrefix: 'RCP',
    allowInstallments: true,
    defaultInstallments: 3,
    paymentGraceDays: 14,
    lateFeePercent: 0,
    siblingDiscountPercent: 0,
    paymentProvider: 'NONE',
  },
  sync: { conflictPolicy: 'LATEST_WINS', attendanceWindowDays: 45 },
  canteen: { defaultDailyLimit: 0, allowNegativeStock: false, selfServicePlans: true },
  communication: { announcementChannels: ['IN_APP'], smsEnabled: true, emailEnabled: true, feeReminderDaysBefore: 3 },
};

export function mergeSettings(stored: any): SchoolSettings {
  const s = stored && typeof stored === 'object' ? stored : {};
  const out: any = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    out[key] = { ...(DEFAULT_SETTINGS as any)[key], ...(s[key] ?? {}) };
  }
  return out as SchoolSettings;
}

/** Website builder default configuration for a new school. */
export function defaultWebsiteConfig(schoolName: string) {
  return {
    nav: [
      { label: 'Home', href: '/' },
      { label: 'Admissions', href: '/admissions' },
      { label: 'Portal', href: '/login' },
    ],
    footer: { text: `© ${new Date().getFullYear()} ${schoolName}. All rights reserved.`, showContact: true },
    sections: [
      {
        id: 'hero',
        type: 'hero',
        enabled: true,
        props: {
          title: `Welcome to ${schoolName}`,
          subtitle: 'Nurturing excellence, character and leadership.',
          ctaLabel: 'Apply now',
          ctaHref: '/admissions',
        },
      },
      {
        id: 'about',
        type: 'about',
        enabled: true,
        props: {
          title: 'About our school',
          body: 'Write a short introduction to your school here. You can edit every section from Settings → Website.',
        },
      },
      {
        id: 'programs',
        type: 'programs',
        enabled: true,
        props: {
          title: 'Our programmes',
          items: [
            { title: 'Early Years', body: 'Play-based learning for the youngest minds.' },
            { title: 'Primary', body: 'Strong foundations in literacy, numeracy and character.' },
            { title: 'Junior High', body: 'Preparing students for the BECE and beyond.' },
          ],
        },
      },
      {
        id: 'why',
        type: 'features',
        enabled: true,
        props: {
          title: 'Why choose us',
          items: [
            { title: 'Qualified teachers', body: 'Experienced, caring professionals.' },
            { title: 'Safe environment', body: 'A secure campus with modern facilities.' },
            { title: 'Holistic growth', body: 'Academics, sports, arts and values.' },
          ],
        },
      },
      {
        id: 'stats',
        type: 'stats',
        enabled: true,
        props: {
          items: [
            { label: 'Students', value: '500+' },
            { label: 'Teachers', value: '40+' },
            { label: 'Years', value: '15' },
            { label: 'Pass rate', value: '98%' },
          ],
        },
      },
      {
        id: 'principal',
        type: 'message',
        enabled: true,
        props: {
          title: "Principal's message",
          name: 'The Principal',
          body: 'We are committed to giving every child the very best start in life.',
        },
      },
      { id: 'gallery', type: 'gallery', enabled: false, props: { title: 'Gallery', images: [] } },
      { id: 'testimonials', type: 'testimonials', enabled: false, props: { title: 'What parents say', items: [] } },
      { id: 'news', type: 'news', enabled: true, props: { title: 'News & announcements' } },
      { id: 'contact', type: 'contact', enabled: true, props: { title: 'Contact us' } },
    ],
    pages: {
      about: { title: 'About us', body: 'Our history, mission, vision and values.' },
      admissions: {
        title: 'Admissions',
        body: 'Apply online using the form below. Our admissions team will contact you.',
      },
    },
  };
}

/** Rules-engine validation shared by the API and tests. Throws a plain Error with a user-facing message. */
export function validateSettings(s: any) {
  const a = s.academic;
  if (Math.round(Number(a.caWeight) + Number(a.examWeight)) !== 100)
    throw new Error('CA weight and Exam weight must add up to 100');
  if (!Array.isArray(a.gradingScheme) || !a.gradingScheme.length)
    throw new Error('Grading scheme must have at least one band');
  for (const b of a.gradingScheme) {
    if (!b.grade || typeof b.min !== 'number' || typeof b.max !== 'number' || b.min > b.max)
      throw new Error(`Invalid grade band ${b.grade ?? ''}`);
  }
  if (
    !Array.isArray(a.resultApprovalLevels) ||
    a.resultApprovalLevels.some((l: string) => !['REVIEW', 'APPROVE'].includes(l))
  )
    throw new Error('resultApprovalLevels may only contain REVIEW and APPROVE');
  if (s.finance.defaultInstallments < 1 || s.finance.defaultInstallments > 12)
    throw new Error('defaultInstallments must be between 1 and 12');
  if (!['LATEST_WINS', 'SERVER_WINS', 'MANUAL'].includes(s.sync.conflictPolicy))
    throw new Error('Invalid sync conflict policy');
}
