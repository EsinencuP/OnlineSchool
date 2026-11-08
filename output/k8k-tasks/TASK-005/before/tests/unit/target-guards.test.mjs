import { expect, test } from '@jest/globals';
import { testDatabase } from '../support/target.mjs';
test('legacy destructive fixture target is disabled without explicit isolated-target authorization', () => {
  const old = process.env.FND_ALLOW_EPHEMERAL_DATABASES;
  delete process.env.FND_ALLOW_EPHEMERAL_DATABASES;
  try {
    expect(() => testDatabase('postgresql://unused@127.0.0.1/online_school_test_probe')).toThrow(
      'explicit owner exception',
    );
  } finally {
    if (old === undefined) delete process.env.FND_ALLOW_EPHEMERAL_DATABASES;
    else process.env.FND_ALLOW_EPHEMERAL_DATABASES = old;
  }
});
test('even an opted-in fixture refuses cloud hosts, working database names and host overrides', () => {
  const old = process.env.FND_ALLOW_EPHEMERAL_DATABASES;
  process.env.FND_ALLOW_EPHEMERAL_DATABASES = '1';
  try {
    for (const url of [
      'postgresql://unused@remote.example.org/online_school_test_probe',
      'postgresql://unused@127.0.0.1/online_school',
      'postgresql://unused@127.0.0.1/online_school_test_probe?host=remote.example.org',
      'postgresql://unused@127.0.0.1/online_school_test_probe?hostaddr=192.0.2.1',
    ])
      expect(() => testDatabase(url)).toThrow();
  } finally {
    if (old === undefined) delete process.env.FND_ALLOW_EPHEMERAL_DATABASES;
    else process.env.FND_ALLOW_EPHEMERAL_DATABASES = old;
  }
});
