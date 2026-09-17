/**
 * RFC-4180 style CSV parsing/serialisation used by bulk imports and data exports.
 * Handles quoted fields, escaped quotes, CRLF/LF line endings, a UTF-8 BOM and ragged rows.
 */
export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  errors: Array<{ line: number; message: string }>;
}

export function parseCsv(text: string, opts: { maxRows?: number } = {}): ParsedCsv {
  const src = text.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\r') continue;
    if (ch === '\n') {
      row.push(field);
      records.push(row);
      row = [];
      field = '';
      continue;
    }
    field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    records.push(row);
  }
  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ''));
  if (!nonEmpty.length) return { headers: [], rows: [], errors: [{ line: 1, message: 'The file is empty' }] };
  const headers = nonEmpty[0].map((h) =>
    h.trim().replace(/^"|"$/g, '').replace(/\s+/g, '_').replace(/[^\w]/g, '').toLowerCase(),
  );
  const errors: ParsedCsv['errors'] = [];
  const rows: Record<string, string>[] = [];
  nonEmpty.slice(1).forEach((r, idx) => {
    if (opts.maxRows && rows.length >= opts.maxRows) return;
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => (obj[h] = (r[j] ?? '').trim()));
    if (r.length > headers.length)
      errors.push({ line: idx + 2, message: `Row has ${r.length} columns but the header has ${headers.length}` });
    rows.push(obj);
  });
  return { headers, rows, errors };
}

/** Serialises rows to CSV. `columns` fixes the order (and includes empty columns); otherwise the union of keys is used. */
export function toCsv(rows: Record<string, any>[], columns?: string[]): string {
  const keys = new Set<string>();
  if (!columns) rows.forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
  const cols = columns ?? Array.from(keys);
  const esc = (v: any) => {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'object') v = JSON.stringify(v);
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

/** Maps common header spellings to canonical field names for imports (e.g. "First Name" → firstName). */
export function normaliseHeader(h: string): string {
  const key = h.toLowerCase().replace(/[^a-z0-9]/g, '');
  const map: Record<string, string> = {
    firstname: 'firstName',
    givenname: 'firstName',
    lastname: 'lastName',
    surname: 'lastName',
    familyname: 'lastName',
    othernames: 'otherNames',
    middlename: 'otherNames',
    gender: 'gender',
    sex: 'gender',
    dateofbirth: 'dateOfBirth',
    dob: 'dateOfBirth',
    birthdate: 'dateOfBirth',
    class: 'className',
    classname: 'className',
    form: 'className',
    admissiondate: 'admissionDate',
    dateadmitted: 'admissionDate',
    boarding: 'isBoarding',
    isboarding: 'isBoarding',
    boarder: 'isBoarding',
    house: 'house',
    previousschool: 'previousSchool',
    address: 'address',
    medicalnotes: 'medicalNotes',
    allergies: 'medicalNotes',
    guardianfirstname: 'guardianFirstName',
    guardianlastname: 'guardianLastName',
    guardianname: 'guardianName',
    parentname: 'guardianName',
    guardianphone: 'guardianPhone',
    parentphone: 'guardianPhone',
    phone: 'guardianPhone',
    guardianemail: 'guardianEmail',
    parentemail: 'guardianEmail',
    relationship: 'relationship',
    email: 'email',
    staffemail: 'email',
    stafftype: 'staffType',
    department: 'department',
    position: 'position',
    employmentdate: 'employmentDate',
    studentid: 'studentId',
    employeeid: 'employeeId',
  };
  return map[key] ?? h;
}
