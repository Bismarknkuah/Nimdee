/**
 * Ghana basic-school catalogue: KG, Primary (Basic 1–6) and JHS (Basic 7–9).
 *
 * School OS is built for basic schools. A school picks which levels it runs (a KG-only school, a
 * Primary school, a JHS, or a full basic school) and whether it is a day school, a boarding school or
 * both. Everything here is a sensible default that the school can edit in Settings → Rules engine.
 */
import { GradeBand } from './settings';

export type LevelGroup = 'KG' | 'PRIMARY' | 'JHS';
export const LEVEL_GROUPS: LevelGroup[] = ['KG', 'PRIMARY', 'JHS'];
export const LEVEL_LABELS: Record<LevelGroup, string> = {
  KG: 'Kindergarten (KG 1–2)',
  PRIMARY: 'Primary (Basic 1–6)',
  JHS: 'Junior High School (Basic 7–9 / JHS 1–3)',
};

export type Residency = 'DAY' | 'BOARDING' | 'DAY_AND_BOARDING';
export const RESIDENCY_OPTIONS: Residency[] = ['DAY', 'BOARDING', 'DAY_AND_BOARDING'];
export const RESIDENCY_LABELS: Record<Residency, string> = {
  DAY: 'Day school',
  BOARDING: 'Boarding school',
  DAY_AND_BOARDING: 'Day and boarding',
};

export interface StandardClass {
  /** Display name used when the class is created */
  name: string;
  /** Level group the class belongs to (drives grading scheme, fee structures and subject presets) */
  level: LevelGroup;
  /** Basic-education stage number (KG 1 = -1, KG 2 = 0, Basic 1 = 1 … JHS 3 = 9) — used to order promotion */
  stage: number;
  /** Alternative names the class may already have been created under */
  aliases: string[];
}

/** The standard progression. Promotion follows this order; JHS 3 graduates (BECE candidates). */
export const STANDARD_CLASSES: StandardClass[] = [
  { name: 'KG 1', level: 'KG', stage: -1, aliases: ['Kindergarten 1', 'KG1'] },
  { name: 'KG 2', level: 'KG', stage: 0, aliases: ['Kindergarten 2', 'KG2'] },
  { name: 'Basic 1', level: 'PRIMARY', stage: 1, aliases: ['Primary 1', 'Class 1', 'P1'] },
  { name: 'Basic 2', level: 'PRIMARY', stage: 2, aliases: ['Primary 2', 'Class 2', 'P2'] },
  { name: 'Basic 3', level: 'PRIMARY', stage: 3, aliases: ['Primary 3', 'Class 3', 'P3'] },
  { name: 'Basic 4', level: 'PRIMARY', stage: 4, aliases: ['Primary 4', 'Class 4', 'P4'] },
  { name: 'Basic 5', level: 'PRIMARY', stage: 5, aliases: ['Primary 5', 'Class 5', 'P5'] },
  { name: 'Basic 6', level: 'PRIMARY', stage: 6, aliases: ['Primary 6', 'Class 6', 'P6'] },
  { name: 'JHS 1', level: 'JHS', stage: 7, aliases: ['Basic 7', 'JHS1', 'Form 1'] },
  { name: 'JHS 2', level: 'JHS', stage: 8, aliases: ['Basic 8', 'JHS2', 'Form 2'] },
  { name: 'JHS 3', level: 'JHS', stage: 9, aliases: ['Basic 9', 'JHS3', 'Form 3'] },
];

export interface SubjectPreset {
  name: string;
  code: string;
  isCore: boolean;
}

/** GES standards-based curriculum subjects per level. */
export const GES_SUBJECTS: Record<LevelGroup, SubjectPreset[]> = {
  KG: [
    { name: 'Language & Literacy', code: 'LIT', isCore: true },
    { name: 'Numeracy', code: 'NUM', isCore: true },
    { name: 'Our World Our People', code: 'OWOP', isCore: true },
    { name: 'Creative Arts', code: 'CART', isCore: true },
    { name: 'Physical Development', code: 'PD', isCore: false },
  ],
  PRIMARY: [
    { name: 'English Language', code: 'ENG', isCore: true },
    { name: 'Mathematics', code: 'MATH', isCore: true },
    { name: 'Science', code: 'SCI', isCore: true },
    { name: 'Our World Our People', code: 'OWOP', isCore: true },
    { name: 'Religious & Moral Education', code: 'RME', isCore: true },
    { name: 'Ghanaian Language', code: 'GHL', isCore: true },
    { name: 'Creative Arts', code: 'CART', isCore: true },
    { name: 'History', code: 'HIST', isCore: true },
    { name: 'Computing', code: 'ICT', isCore: true },
    { name: 'Physical Education', code: 'PE', isCore: false },
    { name: 'French', code: 'FRE', isCore: false },
  ],
  JHS: [
    { name: 'English Language', code: 'ENG', isCore: true },
    { name: 'Mathematics', code: 'MATH', isCore: true },
    { name: 'Integrated Science', code: 'SCI', isCore: true },
    { name: 'Social Studies', code: 'SOC', isCore: true },
    { name: 'Religious & Moral Education', code: 'RME', isCore: true },
    { name: 'Computing', code: 'ICT', isCore: true },
    { name: 'Career Technology', code: 'CTECH', isCore: true },
    { name: 'Creative Arts & Design', code: 'CAD', isCore: true },
    { name: 'Ghanaian Language', code: 'GHL', isCore: true },
    { name: 'French', code: 'FRE', isCore: false },
    { name: 'Physical & Health Education', code: 'PHE', isCore: false },
  ],
};

/** BECE-style 1–9 grades used for JHS terminal reports (1 = highest). */
export const JHS_GRADING: GradeBand[] = [
  { grade: '1', min: 80, max: 100, remark: 'Highest', points: 1 },
  { grade: '2', min: 70, max: 79.99, remark: 'Higher', points: 2 },
  { grade: '3', min: 60, max: 69.99, remark: 'High', points: 3 },
  { grade: '4', min: 50, max: 59.99, remark: 'High Average', points: 4 },
  { grade: '5', min: 45, max: 49.99, remark: 'Average', points: 5 },
  { grade: '6', min: 40, max: 44.99, remark: 'Low Average', points: 6 },
  { grade: '7', min: 35, max: 39.99, remark: 'Low', points: 7 },
  { grade: '8', min: 30, max: 34.99, remark: 'Lower', points: 8 },
  { grade: '9', min: 0, max: 29.99, remark: 'Lowest', points: 9 },
];

/** Letter grades commonly used on KG and Primary terminal reports. */
export const PRIMARY_GRADING: GradeBand[] = [
  { grade: 'A', min: 80, max: 100, remark: 'Excellent', points: 1 },
  { grade: 'B', min: 70, max: 79.99, remark: 'Very Good', points: 2 },
  { grade: 'C', min: 60, max: 69.99, remark: 'Good', points: 3 },
  { grade: 'D', min: 50, max: 59.99, remark: 'Credit', points: 4 },
  { grade: 'E', min: 40, max: 49.99, remark: 'Pass', points: 5 },
  { grade: 'F', min: 0, max: 39.99, remark: 'Needs improvement', points: 6 },
];

/** Maps any stored class level (or legacy free-text level) to a level group. */
export function levelGroupOf(level?: string | null): LevelGroup {
  const l = (level ?? '').toUpperCase();
  if (l.startsWith('KG') || l.includes('KINDER') || l.includes('NURSERY')) return 'KG';
  if (l.startsWith('JHS') || l.includes('JUNIOR') || l === 'BASIC 7' || l === 'BASIC 8' || l === 'BASIC 9') return 'JHS';
  return 'PRIMARY';
}

/** Finds the standard class definition for an existing class name (exact or alias). */
export function standardClassFor(name: string): StandardClass | undefined {
  const n = name.trim().toLowerCase();
  return STANDARD_CLASSES.find((c) => c.name.toLowerCase() === n || c.aliases.some((a) => a.toLowerCase() === n));
}
