const SYSTEM_USERS = new Set([
  'root', 'admin', 'administrator', 'user', 'users', 'ubuntu', 'ec2-user', 'centos', 'debian', 'fedora',
  'nobody', 'daemon', 'www-data', 'nginx', 'apache', 'postgres', 'mysql', 'redis', 'git', 'guest',
  'test', 'invalid', 'public', 'default', 'system', 'unknown', 'shared', 'all',
]);

const RESERVED_HOSTS = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback', 'broadcasthost']);

const TRIVIAL_SECRETS = new Set([
  'true', 'false', 'null', 'none', 'nil', 'undefined', 'empty', 'yes', 'no', 'redacted', 'required', 'optional',
]);

export function isIPv4(value: string): boolean {
  const octets = value.split('.');
  return octets.length === 4 && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
}

export function isIPv6(value: string): boolean {
  if (!/\d/.test(value)) return false;
  const halves = value.split('::');
  if (halves.length > 2) return false;
  const groups = halves.flatMap((half) => (half === '' ? [] : half.split(':')));
  const last = groups.at(-1) ?? '';
  let size = groups.length;
  if (last.includes('.')) {
    if (!isIPv4(last)) return false;
    groups.pop();
    size += 1;
  }
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) return false;
  if (size === 0) return false;
  return halves.length === 2 ? size <= 7 : size === 8;
}

export function passesLuhn(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function isNik(value: string): boolean {
  if (!/^\d{16}$/.test(value)) return false;
  const province = Number(value.slice(0, 2));
  const day = Number(value.slice(6, 8)) % 40;
  const month = Number(value.slice(8, 10));
  return province >= 11 && province <= 94 && day >= 1 && day <= 31 && month >= 1 && month <= 12;
}

export function isSsn(value: string): boolean {
  const [area = '', group = '', serial = ''] = value.split('-');
  return area !== '000' && area !== '666' && !area.startsWith('9') && group !== '00' && serial !== '0000';
}

export function isNationalId(value: string): boolean {
  if (/^\d{16}$/.test(value)) return isNik(value);
  if (/^\d{3}-\d{2}-\d{4}$/.test(value)) return isSsn(value);
  return true;
}

export function isPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '').length;
  return digits >= 9 && digits <= 15;
}

export function isUser(value: string): boolean {
  return value.length >= 2 && !/^\d+$/.test(value) && !SYSTEM_USERS.has(value.toLowerCase());
}

export function isHost(value: string): boolean {
  return /[a-z]/i.test(value) && !value.includes('..') && !RESERVED_HOSTS.has(value.toLowerCase());
}

export function isSecret(value: string): boolean {
  return !TRIVIAL_SECRETS.has(value.toLowerCase()) && !/^[*x•.]+$/i.test(value);
}
