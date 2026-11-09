import { isHost, isIPv4, isIPv6, isNationalId, isPhone, isSecret, isUser, looksRandom, passesLuhn } from './validators';

export type Category =
  | 'email'
  | 'ip'
  | 'mac'
  | 'host'
  | 'user'
  | 'secret'
  | 'phone'
  | 'card'
  | 'nationalId'
  | 'location';

export const CATEGORIES: readonly { id: Category; name: string; example: string }[] = [
  { id: 'email', name: 'Email addresses', example: 'jane@acme.com' },
  { id: 'ip', name: 'IP addresses', example: '10.0.0.12, fe80::1' },
  { id: 'mac', name: 'MAC addresses', example: '3c:22:fb:9a:10:7e' },
  { id: 'host', name: 'Hostnames', example: 'web-prod-01, db.acme.internal' },
  { id: 'user', name: 'Usernames', example: 'jane@host:~$, /home/jane' },
  { id: 'secret', name: 'Passwords, tokens & keys', example: 'password=…, Bearer …' },
  { id: 'phone', name: 'Phone numbers', example: '+62 812-3456-7890' },
  { id: 'card', name: 'Payment cards', example: '4111 1111 1111 1111' },
  { id: 'nationalId', name: 'National IDs', example: 'NIK, NPWP, SSN' },
  { id: 'location', name: 'Addresses & coordinates', example: 'Jl. Sudirman No. 1' },
];

export const LABEL_CATEGORY: Readonly<Record<string, Category>> = {
  EMAIL: 'email',
  IPV4: 'ip',
  IPV6: 'ip',
  MAC: 'mac',
  HOST: 'host',
  USER: 'user',
  SECRET: 'secret',
  PRIVATE_KEY: 'secret',
  PHONE: 'phone',
  CARD: 'card',
  NATIONAL_ID: 'nationalId',
  LOCATION: 'location',
};

export const VALIDATORS: Readonly<Record<string, (value: string) => boolean>> = {
  IPV4: isIPv4,
  IPV6: isIPv6,
  HOST: isHost,
  USER: isUser,
  SECRET: isSecret,
  PHONE: isPhone,
  CARD: passesLuhn,
  NATIONAL_ID: isNationalId,
};

export const PROPAGATED_LABELS: ReadonlySet<string> = new Set(['USER', 'HOST', 'SECRET', 'LOCATION']);

export interface Rule {
  label?: string;
  priority: number;
  pattern: RegExp;
  validate?: (value: string) => boolean;
}

const SECRET_KEY =
  String.raw`(?:[\w.-]*(?:password|passwd|passphrase|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|session[_-]?id|credentials?)|pass|kata[ _]?sandi|sandi)`;
const SECRET_VALUE = String.raw`(?<SECRET>(?<=")[^"\n]+(?=")|(?<=')[^'\n]+(?=')|[^\s"',;&(){}<>]+)`;
const PRIVATE_TLD = String.raw`(?:internal|local|lan|corp|intra|intranet|localdomain|svc|home\.arpa)`;
const USER_NAME = String.raw`[a-z_][\w.-]{0,31}`;

export const RULES: readonly Rule[] = [
  {
    label: 'PRIVATE_KEY',
    priority: 99,
    pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/dg,
  },
  {
    priority: 95,
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/(?<USER>[^\s:@/]+):(?<SECRET>[^\s@/]+)@/dgi,
  },
  {
    priority: 55,
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/(?:[^\s:@/]+(?::[^\s@/]*)?@)?(?<HOST>[A-Za-z0-9][\w-]*)(?![\w.-])/dgi,
  },
  {
    label: 'SECRET',
    priority: 94,
    pattern:
      /\beyJ[\w-]{5,}\.eyJ[\w-]{5,}\.[\w-]{5,}|\b(?:AKIA|ASIA)[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_\w{22,}|\bglpat-[\w-]{20,}|\bxox[abprs]-[A-Za-z0-9-]{10,}|\bAIza[\w-]{35}|\bsk-(?:ant-|proj-)?[\w-]{20,}|\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}\b|\bnpm_[A-Za-z0-9]{36}\b/dg,
  },
  {
    priority: 93,
    pattern: /\b(?:Bearer|Basic)\s+(?=[^\s]*[\d._~+/=-])(?<SECRET>[A-Za-z0-9._~+/=-]{12,})/dgi,
  },
  {
    priority: 92,
    pattern: /^(?:Set-)?Cookie:[ \t]*(?<SECRET>[^\r\n]+)/dgim,
  },
  {
    priority: 90,
    pattern: new RegExp(String.raw`(?<![\w.-])["']?${SECRET_KEY}["']?[ \t]*[:=][ \t]*["']?${SECRET_VALUE}`, 'dgi'),
  },
  {
    priority: 90,
    pattern: /(?<![\w-])--?[\w-]*(?:password|passwd|pass|token|secret|api-?key)(?:=|[ \t]+)["']?(?<SECRET>[^\s"']+)/dgi,
  },
  {
    priority: 90,
    pattern: /\bIDENTIFIED\s+BY\s+'(?<SECRET>[^'\n]+)'/dgi,
  },
  {
    priority: 90,
    pattern: /\bmachine\s+(?<HOST>\S+)\s+login\s+(?<USER>\S+)\s+password\s+(?<SECRET>\S+)/dg,
  },
  {
    label: 'EMAIL',
    priority: 88,
    pattern: /(?<![\w.+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/dg,
  },
  {
    priority: 85,
    pattern: new RegExp(
      String.raw`(?<![\w.-])(?<USER>${USER_NAME})@(?<HOST>[A-Za-z0-9][\w.-]*?)(?=:[~/]|[ \t]+[~/][^\s\]]*\]?[ \t]?[#$%]|\]?[#$%][ \t])`,
      'dgi',
    ),
  },
  {
    priority: 85,
    pattern: new RegExp(
      String.raw`\b(?:ssh|scp|sftp|rsync|mosh)\b[^\n]*?(?<![\w.+-])(?<USER>${USER_NAME})@(?<HOST>[A-Za-z0-9][\w-]*(?:\.[\w-]+)*)`,
      'dgi',
    ),
  },
  {
    priority: 84,
    pattern:
      /\b(?:password|publickey|keyboard-interactive(?:\/pam)?)\s+for\s+(?:invalid\s+user\s+)?(?<USER>[\w.-]+)|\bInvalid user\s+(?<USER2>[\w.-]+)|\bsession (?:opened|closed) for user\s+(?<USER3>[\w.-]+)|\bsudo:\s+(?<USER4>[\w.-]+)\s*:/dgi,
  },
  {
    priority: 84,
    pattern: /(?:\/home\/|\/Users\/|[A-Za-z]:\\Users\\)(?<USER>[\w.-]+)/dg,
  },
  {
    priority: 80,
    pattern: /(?<![\w.-])["']?(?:user(?:name)?|login|owner|nama[ _]pengguna|pengguna)["']?[ \t]*[:=][ \t]*["']?(?<USER>[\w.-]{2,64})/dgi,
  },
  {
    label: 'MAC',
    priority: 78,
    pattern:
      /(?<![\w:-])[0-9A-Fa-f]{2}([:-])(?:[0-9A-Fa-f]{2}\1){4}[0-9A-Fa-f]{2}(?![\w:-])|(?<![\w.])[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}(?![\w.])/dg,
  },
  {
    label: 'IPV4',
    priority: 76,
    pattern: /(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?!\w|\.\d)/dg,
  },
  {
    label: 'IPV6',
    priority: 77,
    pattern: /(?<![\w:])(?:[0-9a-fA-F]{0,4}:){2,7}(?:[0-9a-fA-F]{1,4}|(?<=:)(?:\d{1,3}\.){3}\d{1,3})?(?![\w:]|\.\d)/dg,
  },
  {
    label: 'CARD',
    priority: 67,
    pattern: /(?<![\w-])(?:\d[ -]?){12,18}\d(?![\w-])/dg,
  },
  {
    label: 'NATIONAL_ID',
    priority: 66,
    pattern: /(?<![\w.-])(?:\d{16}|\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}|\d{3}-\d{2}-\d{4})(?![\w-]|\.\d)/dg,
  },
  {
    priority: 62,
    pattern:
      /^(?:[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)\s+(?<HOST>[A-Za-z0-9][\w.-]*)\s+[\w/.-]+(?:\[\d+\])?:/dgm,
  },
  {
    priority: 60,
    pattern: /(?<![\w.-])["']?(?:hostname|host|fqdn)["']?[ \t]*[:=][ \t]*["']?(?<HOST>[A-Za-z0-9][\w.-]*)/dgi,
  },
  {
    label: 'HOST',
    priority: 50,
    pattern: new RegExp(
      String.raw`(?<![\w.-])(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+${PRIVATE_TLD}(?!\.?[\w-])`,
      'dg',
    ),
  },
  {
    label: 'SECRET',
    priority: 45,
    pattern: /(?<![\w+/=.-])(?<!\b(?:commit|sha\d*|digest|checksum)[:= \t]+)(?:[0-9a-fA-F]{32,}|[A-Za-z0-9+/_-]{32,}={0,2})(?![\w+/=.-])/dg,
    validate: looksRandom,
  },
  {
    label: 'PHONE',
    priority: 40,
    pattern: /(?<![\w+])(?:\+\d{1,3}[ \t-]?\(?\d{1,4}\)?|\(?0\d{2,4}\)?)(?:[ \t-]?\d{2,5}){2,4}(?![\w-])|(?<!\w)\(\d{3}\)[ \t]?\d{3}-\d{4}(?!\w)/dg,
  },
  {
    label: 'LOCATION',
    priority: 30,
    pattern:
      /\b(?:Jl|Jln|Jalan)\.?[ \t]+[A-Z][^\n,;]{1,60}|\b\d{1,5}[ \t]+(?:[A-Z][a-z]+[ \t]+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct|Place|Pl)\b\.?|(?<![\w.-])-?(?:[1-8]?\d\.\d{3,}|90\.0{3,})[ \t]*,[ \t]*-?(?:1[0-7]\d|\d{1,2})\.\d{3,}(?![\w.])/dg,
  },
  {
    priority: 30,
    pattern: /\b(?:alamat|(?:home|street|mailing|billing|shipping)[ \t]+address)[ \t]*[:=][ \t]*(?<LOCATION>[^\n]{3,120})/dgi,
  },
];
