/**
 * Transactional message templates (email HTML + SMS text). Kept as plain functions so they are easy to
 * preview, test and translate. Every email uses the school's colour and name.
 */
export interface Brand {
  name: string;
  primaryColor?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  portalUrl?: string;
}

const esc = (s: any) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

export function layout(brand: Brand, title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  const color = brand.primaryColor || '#1d4ed8';
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:${color};padding:20px 24px;color:#fff">
${brand.logoUrl ? `<img src="${esc(brand.logoUrl)}" alt="" width="40" height="40" style="border-radius:8px;vertical-align:middle;margin-right:10px">` : ''}<span style="font-size:18px;font-weight:700;vertical-align:middle">${esc(brand.name)}</span></td></tr>
<tr><td style="padding:24px"><h1 style="margin:0 0 12px;font-size:20px">${esc(title)}</h1><div style="font-size:15px;line-height:1.55">${bodyHtml}</div>
${cta ? `<p style="margin:24px 0 8px"><a href="${esc(cta.url)}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${esc(cta.label)}</a></p>` : ''}</td></tr>
<tr><td style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px">${esc([brand.address, brand.phone].filter(Boolean).join(' · '))}<br>Sent by Nimdee on behalf of ${esc(brand.name)}.</td></tr>
</table></td></tr></table></body></html>`;
}

export const templates = {
  welcomeUser: (
    brand: Brand,
    p: { name: string; email: string; temporaryPassword: string; school: string; loginUrl: string },
  ) => ({
    subject: `Your ${brand.name} account`,
    text: `Hello ${p.name},\n\nAn account has been created for you at ${brand.name}.\nSchool: ${p.school}\nEmail: ${p.email}\nTemporary password: ${p.temporaryPassword}\n\nSign in at ${p.loginUrl} and change your password.`,
    html: layout(
      brand,
      'Welcome to your school portal',
      `<p>Hello ${esc(p.name)},</p><p>An account has been created for you.</p><table style="font-size:14px;border-collapse:collapse"><tr><td style="padding:4px 12px 4px 0;color:#64748b">School</td><td><b>${esc(p.school)}</b></td></tr><tr><td style="padding:4px 12px 4px 0;color:#64748b">Email</td><td><b>${esc(p.email)}</b></td></tr><tr><td style="padding:4px 12px 4px 0;color:#64748b">Temporary password</td><td><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">${esc(p.temporaryPassword)}</code></td></tr></table><p>You will be asked to choose a new password when you first sign in.</p>`,
      { label: 'Sign in', url: p.loginUrl },
    ),
  }),
  passwordReset: (brand: Brand, p: { name: string; url: string; minutes: number }) => ({
    subject: `Reset your ${brand.name} password`,
    text: `Hello ${p.name},\n\nUse this link to choose a new password (valid for ${p.minutes} minutes):\n${p.url}\n\nIf you did not request this, ignore this message.`,
    html: layout(
      brand,
      'Reset your password',
      `<p>Hello ${esc(p.name)},</p><p>Someone asked to reset the password for this account. The link below is valid for ${p.minutes} minutes.</p><p style="color:#64748b;font-size:13px">If you did not request this, you can safely ignore this email — your password will not change.</p>`,
      { label: 'Choose a new password', url: p.url },
    ),
  }),
  receipt: (
    brand: Brand,
    p: {
      student: string;
      amount: string;
      receiptNumber: string;
      method: string;
      balance: string;
      invoice?: string;
      date: string;
      url?: string;
    },
  ) => ({
    subject: `Receipt ${p.receiptNumber} — ${brand.name}`,
    text: `Payment received for ${p.student}.\nAmount: ${p.amount}\nReceipt: ${p.receiptNumber}\nMethod: ${p.method}\n${p.invoice ? `Invoice: ${p.invoice}\n` : ''}Outstanding balance: ${p.balance}\nDate: ${p.date}`,
    html: layout(
      brand,
      'Payment received',
      `<p>Thank you. We have received a payment for <b>${esc(p.student)}</b>.</p><table style="font-size:14px;border-collapse:collapse">${[['Amount', p.amount], ['Receipt no.', p.receiptNumber], ['Method', p.method], ...(p.invoice ? [['Invoice', p.invoice]] : []), ['Date', p.date], ['Outstanding balance', p.balance]].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}</table>`,
      p.url ? { label: 'View in portal', url: p.url } : undefined,
    ),
  }),
  feeReminder: (
    brand: Brand,
    p: {
      student: string;
      invoice: string;
      balance: string;
      dueDate: string;
      nextInstallment?: string;
      url?: string;
      overdue: boolean;
    },
  ) => ({
    subject: `${p.overdue ? 'Overdue' : 'Reminder'}: school fees for ${p.student}`,
    text: `${brand.name}: ${p.overdue ? 'Fees are overdue' : 'Fees reminder'} for ${p.student}. Invoice ${p.invoice}, balance ${p.balance}, due ${p.dueDate}.${p.nextInstallment ? ` Next installment: ${p.nextInstallment}.` : ''} Please pay at the school office or online.`,
    html: layout(
      brand,
      p.overdue ? 'School fees overdue' : 'School fees reminder',
      `<p>This is a ${p.overdue ? '<b>reminder that fees are overdue</b>' : 'friendly reminder'} for <b>${esc(p.student)}</b>.</p><table style="font-size:14px;border-collapse:collapse">${[['Invoice', p.invoice], ['Outstanding balance', p.balance], ['Due date', p.dueDate], ...(p.nextInstallment ? [['Next installment', p.nextInstallment]] : [])].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}</table><p>You can pay at the school office, by Mobile Money, or online through the parent portal.</p>`,
      p.url ? { label: 'Pay online', url: p.url } : undefined,
    ),
  }),
  absence: (brand: Brand, p: { student: string; date: string; status: string; className: string }) => ({
    subject: `${p.student} was marked ${p.status.toLowerCase()} today`,
    text: `${brand.name}: ${p.student} (${p.className}) was marked ${p.status} on ${p.date}. Please contact the class teacher if this is unexpected.`,
    html: layout(
      brand,
      'Attendance notice',
      `<p><b>${esc(p.student)}</b> (${esc(p.className)}) was marked <b>${esc(p.status)}</b> on ${esc(p.date)}.</p><p>If this is unexpected, please contact the class teacher or the school office.</p>`,
    ),
  }),
  resultsPublished: (brand: Brand, p: { student: string; term: string; url?: string }) => ({
    subject: `${p.term} results for ${p.student} are ready`,
    text: `${brand.name}: ${p.term} results for ${p.student} are now available in the parent portal.`,
    html: layout(
      brand,
      'Results published',
      `<p>${esc(p.term)} results for <b>${esc(p.student)}</b> are now available. Sign in to the portal to view the report card.</p>`,
      p.url ? { label: 'View results', url: p.url } : undefined,
    ),
  }),
  announcement: (brand: Brand, p: { title: string; body: string }) => ({
    subject: `${brand.name}: ${p.title}`,
    text: `${brand.name}: ${p.title}\n\n${p.body}`,
    html: layout(brand, p.title, `<p style="white-space:pre-line">${esc(p.body)}</p>`),
  }),
};
