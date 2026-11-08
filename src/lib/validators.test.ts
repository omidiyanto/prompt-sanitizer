import { describe, expect, it } from 'vitest';
import { isHost, isIPv4, isIPv6, isNik, isSecret, isSsn, isUser, passesLuhn } from './validators';

describe('validators', () => {
  it('validates IPv4', () => {
    expect(isIPv4('255.255.255.255')).toBe(true);
    expect(isIPv4('256.1.1.1')).toBe(false);
    expect(isIPv4('1.2.3')).toBe(false);
  });

  it('validates IPv6', () => {
    for (const valid of ['::1', '2001:db8::1', '2001:0db8:0000:0000:0000:ff00:0042:8329', '::ffff:192.0.2.1']) {
      expect(isIPv6(valid)).toBe(true);
    }
    for (const invalid of ['::', '1:2:3', 'aa:bb:cc:dd:ee:ff', '1::2::3', 'dead::beef', '1:2:3:4:5:6:7:8:9', '::ffff:999.0.0.1']) {
      expect(isIPv6(invalid)).toBe(false);
    }
  });

  it('runs the Luhn checksum', () => {
    expect(passesLuhn('4111111111111111')).toBe(true);
    expect(passesLuhn('4111111111111112')).toBe(false);
    expect(passesLuhn('1234')).toBe(false);
  });

  it('checks NIK structure', () => {
    expect(isNik('3171012501990001')).toBe(true);
    expect(isNik('3171016501990001')).toBe(true);
    expect(isNik('3171013201990001')).toBe(false);
    expect(isNik('3171012513990001')).toBe(false);
  });

  it('checks SSN allocation rules', () => {
    expect(isSsn('123-45-6789')).toBe(true);
    expect(isSsn('666-45-6789')).toBe(false);
    expect(isSsn('900-45-6789')).toBe(false);
    expect(isSsn('123-00-6789')).toBe(false);
  });

  it('filters out system users, reserved hosts and placeholder secrets', () => {
    expect(isUser('budi')).toBe(true);
    expect(isUser('ROOT')).toBe(false);
    expect(isUser('1000')).toBe(false);
    expect(isHost('web-01')).toBe(true);
    expect(isHost('localhost')).toBe(false);
    expect(isHost('1.2.3')).toBe(false);
    expect(isSecret('hunter2')).toBe(true);
    expect(isSecret('NULL')).toBe(false);
    expect(isSecret('****')).toBe(false);
  });
});
