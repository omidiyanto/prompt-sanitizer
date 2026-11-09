import { describe, expect, it } from 'vitest';
import { RULES, type Category } from './rules';
import { sanitize, type SanitizeOptions, type Term } from './sanitize';
import { SAMPLE } from './sample';
import { defaultSettings } from './settings';

function options(overrides: Partial<SanitizeOptions> = {}): SanitizeOptions {
  return { terms: [], domains: [], enabled: defaultSettings().enabled, ...overrides };
}

const clean = (text: string, overrides?: Partial<SanitizeOptions>) => sanitize(text, options(overrides)).output;

describe('rules', () => {
  it('compiles every pattern with the global and indices flags', () => {
    for (const rule of RULES) {
      expect(rule.pattern.flags).toContain('g');
      expect(rule.pattern.flags).toContain('d');
    }
  });
});

describe('structured identifiers', () => {
  it.each([
    ['mail jane.doe+ops@acme.com now', 'mail [EMAIL_1] now'],
    ['from 192.168.10.254 port 22', 'from [IPV4_1] port 22'],
    ['peer 2001:db8:85a3::8a2e:370:7334 up', 'peer [IPV6_1] up'],
    ['lo ::1 and fe80::1c2b:3aff:fe4d:5e6f', 'lo [IPV6_1] and [IPV6_2]'],
    ['mapped ::ffff:10.0.0.1 ok', 'mapped [IPV6_1] ok'],
    ['ether 3c:22:fb:9a:10:7e', 'ether [MAC_1]'],
    ['hw 3C-22-FB-9A-10-7E', 'hw [MAC_1]'],
    ['cisco 3c22.fb9a.107e', 'cisco [MAC_1]'],
    ['card 4111 1111 1111 1111 exp', 'card [CARD_1] exp'],
    ['nik 3171012501990001 ok', 'nik [NATIONAL_ID_1] ok'],
    ['npwp 01.234.567.8-901.000', 'npwp [NATIONAL_ID_1]'],
    ['ssn 123-45-6789', 'ssn [NATIONAL_ID_1]'],
    ['call +62 812-3456-7890', 'call [PHONE_1]'],
    ['call 0812-3456-7890', 'call [PHONE_1]'],
    ['call (415) 555-0132', 'call [PHONE_1]'],
  ])('redacts %j', (input, expected) => {
    expect(clean(input)).toBe(expected);
  });

  it.each([
    'version 1.2.3.4.5',
    'build v1.2.3.4',
    'octets 999.1.1.1',
    'at 12:30:45 today',
    'std::vector<int> and Foo::Bar',
    'card 4111 1111 1111 1112',
    'nik 9971012501990001',
    'date 08-11-2024 10:42',
    'port 52144 pid 2231',
    'sha 3f786850e387550fdab836ed7e6dc881de23001b',
    'logger.info(user.id) and this.app.listen()',
    'System.Net.Http',
    'max_tokens: 1024 and prompt_tokens=50',
  ])('leaves %j untouched', (input) => {
    expect(clean(input)).toBe(input);
  });
});

describe('hosts and users', () => {
  it('reads users and hosts from shell prompts', () => {
    expect(clean('jane@web-prod-01:~$ ls')).toBe('[USER_1]@[HOST_1]:~$ ls');
    expect(clean('[jane@db01 ~]$ uptime')).toBe('[[USER_1]@[HOST_1] ~]$ uptime');
  });

  it('reads hosts from syslog lines and URLs', () => {
    expect(clean('Nov  8 10:42:17 web-prod-01 sshd[2231]: hi')).toBe('Nov  8 10:42:17 [HOST_1] sshd[2231]: hi');
    expect(clean('GET http://billing-svc:8080/v1')).toBe('GET http://[HOST_1]:8080/v1');
    expect(clean('ssh deploy@bastion')).toBe('ssh [USER_1]@[HOST_1]');
  });

  it('redacts names under private-only TLDs but leaves public domains alone', () => {
    expect(clean('resolve db.maju.co.id and cache.prod.internal')).toBe('resolve db.maju.co.id and [HOST_1]');
    expect(clean('see https://github.com/org/repo and docs.python.org')).toBe(
      'see https://github.com/org/repo and docs.python.org',
    );
  });

  it('reads users from sshd, sudo, home paths and key-value pairs', () => {
    expect(clean('Accepted publickey for andi from 1.2.3.4')).toBe('Accepted publickey for [USER_1] from [IPV4_1]');
    expect(clean('Invalid user oracle from 1.2.3.4')).toBe('Invalid user [USER_1] from [IPV4_1]');
    expect(clean('sudo:   budi : TTY=pts/0')).toBe('sudo:   [USER_1] : TTY=pts/0');
    expect(clean('cat /home/budi/.bashrc C:\\Users\\Siti\\x')).toBe('cat /home/[USER_1]/.bashrc C:\\Users\\[USER_2]\\x');
    expect(clean('{"username": "budi.s"}')).toBe('{"username": "[USER_1]"}');
  });

  it('does not treat system accounts or localhost as personal data', () => {
    expect(clean('root@localhost:~# ls')).toBe('root@localhost:~# ls');
    expect(clean('Failed password for invalid user admin from 10.0.0.1')).toBe(
      'Failed password for invalid user admin from [IPV4_1]',
    );
  });
});

describe('secrets', () => {
  it.each([
    ['DB_PASSWORD=hunter2!', 'DB_PASSWORD=[SECRET_1]'],
    ['password: "correct horse battery"', 'password: "[SECRET_1]"'],
    ["{'api_key': 'abc123xyz'}", "{'api_key': '[SECRET_1]'}"],
    ['AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG', 'AWS_SECRET_ACCESS_KEY=[SECRET_1]'],
    ['mysql --password=Zx9!pq', 'mysql --password=[SECRET_1]'],
    ["CREATE USER x IDENTIFIED BY 'P@ss w0rd'", "CREATE USER x IDENTIFIED BY '[SECRET_1]'"],
    ['Authorization: Bearer abc.def-123_456', 'Authorization: Bearer [SECRET_1]'],
    ['Cookie: sid=1; theme=dark', 'Cookie: [SECRET_1]'],
    ['key AKIAIOSFODNN7EXAMPLE', 'key [SECRET_1]'],
    ['ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789', '[SECRET_1]'],
    ['sk-ant-api03-abcdefghijklmnopqrstuv', '[SECRET_1]'],
    ['kata sandi: rahasia123', 'kata sandi: [SECRET_1]'],
    ['redis://svc_orders:s3cret@cache.acme.internal:6379', 'redis://[USER_1]:[SECRET_1]@[HOST_1]:6379'],
    ['redis://default:s3cret@cache', 'redis://default:[SECRET_1]@[HOST_1]'],
  ])('redacts %j', (input, expected) => {
    expect(clean(input)).toBe(expected);
  });

  it('redacts whole PEM private key blocks', () => {
    const key = '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n-----END OPENSSH PRIVATE KEY-----';
    expect(clean(`key:\n${key}\ndone`)).toBe('key:\n[PRIVATE_KEY_1]\ndone');
  });

  it('ignores placeholder values', () => {
    expect(clean('password=******** token: null')).toBe('password=******** token: null');
  });

  it('redacts bare random tokens such as openssl rand output', () => {
    const hex = 'ccc9bf0ed0f22c3bf8e2a8fe744f558fdaf601fce8429ae9e26d738617367f1b';
    expect(clean(`root@omi-vm:~# openssl rand -hex 32\n${hex}`)).toBe('root@[HOST_1]:~# openssl rand -hex 32\n[SECRET_1]');
    expect(clean('secret is q7Zp2Kx9LmN4vB8tR1wY6cF3hJ0sD5gA+eU=')).toBe('secret is [SECRET_1]');
  });

  it.each([
    'commit 3f2a9c1 fixed it',
    'commit 3f786850e387550fdab836ed7e6dc881de23001b',
    'image@sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    '00000000000000000000000000000000',
    'AbstractSingletonProxyFactoryBean2Impl',
    'MAX_CONNECTIONS_PER_HOST_2_DEFAULT_VALUE',
    '550e8400-e29b-41d4-a716-446655440000',
  ])('keeps non-random token %j', (input) => {
    expect(clean(input)).toBe(input);
  });

  it('does not redact prose that merely mentions Bearer auth', () => {
    expect(clean('Use Bearer authentication here')).toBe('Use Bearer authentication here');
  });
});

describe('locations', () => {
  it('redacts street addresses and coordinates', () => {
    expect(clean('Kirim ke Jl. Sudirman No. 5, Jakarta')).toBe('Kirim ke [LOCATION_1], Jakarta');
    expect(clean('Ship to 221 Baker Street today')).toBe('Ship to [LOCATION_1] today');
    expect(clean('pin -6.208763, 106.845599 ok')).toBe('pin [LOCATION_1] ok');
    expect(clean('alamat: Perumahan Indah Blok C')).toBe('alamat: [LOCATION_1]');
  });
});

describe('placeholders', () => {
  it('reuses the same placeholder for the same value', () => {
    expect(clean('10.0.0.1 -> 10.0.0.2 -> 10.0.0.1')).toBe('[IPV4_1] -> [IPV4_2] -> [IPV4_1]');
  });

  it('treats emails case-insensitively', () => {
    expect(clean('Jane@Acme.com jane@acme.com')).toBe('[EMAIL_1] [EMAIL_1]');
  });

  it('propagates context-detected values to every other occurrence', () => {
    expect(clean('Nov  8 10:42:17 web-prod-01 cron[1]: x\nwhy is web-prod-01 slow?')).toBe(
      'Nov  8 10:42:17 [HOST_1] cron[1]: x\nwhy is [HOST_1] slow?',
    );
    expect(clean('password=Tr0ub4dor then Tr0ub4dor again')).toBe('password=[SECRET_1] then [SECRET_1] again');
  });

  it('does not propagate inside longer words', () => {
    expect(clean('user=budi and budiman')).toBe('user=[USER_1] and budiman');
  });

  it('returns segments that rebuild the output and carry the original value', () => {
    const result = sanitize('mail a@b.io', options());
    expect(result.segments).toEqual([
      { text: 'mail ' },
      { text: '[EMAIL_1]', label: 'EMAIL', original: 'a@b.io' },
    ]);
    expect(result.counts).toEqual({ EMAIL: 1 });
  });
});

describe('custom terms', () => {
  const terms: Term[] = [
    { label: 'COMPANY', value: 'PT Maju Jaya' },
    { label: 'CLIENT', value: 'Globex' },
    { label: 'CLIENT', value: 'Initech (Asia)' },
  ];

  it('redacts dictionary terms case-insensitively', () => {
    expect(clean('pt maju jaya serves Globex and Initech (Asia).', { terms })).toBe(
      '[COMPANY_1] serves [CLIENT_1] and [CLIENT_2].',
    );
  });

  it('redacts terms inside longer words such as hostnames', () => {
    expect(clean('cpdigicli is down, DIGI-gw too', { terms: [{ label: 'CLIENT', value: 'digi' }] })).toBe(
      'cp[CLIENT_1]cli is down, [CLIENT_1]-gw too',
    );
  });

  it('keeps short terms to whole words', () => {
    expect(clean('ABC team, not abcde', { terms: [{ label: 'CLIENT', value: 'abc' }] })).toBe('[CLIENT_1] team, not abcde');
  });

  it('wins over built-in detectors', () => {
    expect(clean('ping acme.com', { terms: [{ label: 'CLIENT', value: 'acme.com' }] })).toBe('ping [CLIENT_1]');
  });

  it('handles unicode terms', () => {
    expect(clean('Café Ünïcode ltd', { terms: [{ label: 'CLIENT', value: 'café ünïcode' }] })).toBe('[CLIENT_1] ltd');
  });
});

describe('domain blocklist and toggles', () => {
  const domains = ['maju.co.id', 'globex.com'];

  it('redacts blocked domains and all their subdomains', () => {
    expect(clean('ping maju.co.id, API.Maju.co.id and https://db-1.eu.globex.com/x', { domains })).toBe(
      'ping [HOST_1], [HOST_2] and https://[HOST_3]/x',
    );
  });

  it('leaves look-alike and parent domains alone', () => {
    expect(clean('notglobex.com globex.com.evil.io co.id github.com', { domains })).toBe(
      'notglobex.com globex.com.evil.io co.id github.com',
    );
  });

  it('keeps email addresses whole', () => {
    expect(clean('mail budi@maju.co.id', { domains })).toBe('mail [EMAIL_1]');
  });

  it('skips disabled categories', () => {
    const enabled: Record<Category, boolean> = { ...defaultSettings().enabled, ip: false };
    expect(clean('10.0.0.1 a@b.io', { enabled })).toBe('10.0.0.1 [EMAIL_1]');
  });
});

describe('real-world input', () => {
  it('sanitizes the bundled sample without leaking any sensitive value', () => {
    const output = clean(SAMPLE);
    for (const leak of ['web-prod-01', 'andi.wijaya', '203.0.113.42', 'S3cr3t-Pa55', 'maju', 'fe80::', '3c:22', 'wJalr', 'eyJ', '812-3456']) {
      expect(output).not.toContain(leak);
    }
  });

  it('handles megabytes of logs quickly', () => {
    const line = 'Nov  8 10:42:17 web-prod-01 sshd[2231]: Accepted publickey for andi from 10.1.2.3 port 50022 ssh2\n';
    const text = line.repeat(10_000);
    const started = performance.now();
    const result = sanitize(text, options());
    expect(performance.now() - started).toBeLessThan(5_000);
    expect(result.counts).toEqual({ HOST: 1, USER: 1, IPV4: 1 });
  });

  it('returns empty output for empty input', () => {
    expect(sanitize('', options())).toEqual({ output: '', segments: [], counts: {} });
  });
});
