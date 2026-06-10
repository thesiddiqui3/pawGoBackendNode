export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const masked = local.slice(0, 2) + '***';
  return `${masked}@${domain}`;
}

export function maskPhone(phone: string): string {
  return phone.slice(0, 3) + '****' + phone.slice(-3);
}

export function generateOtp(length = 6): string {
  const digits = '0123456789';
  return Array.from({ length }, () => digits[Math.floor(Math.random() * 10)]).join('');
}
