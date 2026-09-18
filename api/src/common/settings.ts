/** Per-school rules engine. Stored as JSON on Tenant.settings and merged with these defaults. */
import { JHS_GRADING, PRIMARY_GRADING, RESIDENCY_OPTIONS, LEVEL_GROUPS, levelGroupOf } from './ghana-basic';

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
    /** Below this average a student repeats the year outright; between this and promotionAverage they
     *  move up but are flagged PROMOTED ON PROBATION for the receiving teacher to watch closely. */
    probationAverage: number;
    caWeight: number;
    examWeight: number;
    resultApprovalLevels: Array<'REVIEW' | 'APPROVE'>;
    termsPerYear: number;
    levels: string[];
    /** Grading bands per level group; falls back to gradingScheme when a level has none */
    gradingSchemes?: Partial<Record<'KG' | 'PRIMARY' | 'JHS', GradeBand[]>>;
  };
  /** Which basic-school levels the school runs and whether it is a day/boarding school */
  school: {
    levels: Array<'KG' | 'PRIMARY' | 'JHS'>;
    residency: 'DAY' | 'BOARDING' | 'DAY_AND_BOARDING';
    curriculum: 'GES_STANDARDS_BASED';
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
    /** Class IDs that do not take part in school feeding (e.g. a boarding-only or off-site class) */
    exemptClassIds: string[];
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
    gradingScheme: JHS_GRADING,
    gradingSchemes: { KG: PRIMARY_GRADING, PRIMARY: PRIMARY_GRADING, JHS: JHS_GRADING },
    passMark: 50,
    promotionAverage: 50,
    probationAverage: 40,
    caWeight: 50,
    examWeight: 50,
    resultApprovalLevels: ['REVIEW', 'APPROVE'],
    termsPerYear: 3,
    levels: ['KG', 'PRIMARY', 'JHS'],
  },
  school: { levels: ['KG', 'PRIMARY', 'JHS'], residency: 'DAY_AND_BOARDING', curriculum: 'GES_STANDARDS_BASED' },
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
  canteen: { defaultDailyLimit: 0, allowNegativeStock: false, selfServicePlans: true, exemptClassIds: [] },
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
          title: "Headmaster's message",
          name: 'The Headmaster',
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
  if (Number(a.probationAverage) > Number(a.promotionAverage))
    throw new Error('Probation average cannot be higher than the promotion average');
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

/** Grading bands for a class level: the level-specific scheme when the school has one, else the general scheme. */
export function schemeForLevel(settings: SchoolSettings, level?: string | null): GradeBand[] {
  const group = levelGroupOf(level);
  return settings.academic.gradingSchemes?.[group] ?? settings.academic.gradingScheme;
}
