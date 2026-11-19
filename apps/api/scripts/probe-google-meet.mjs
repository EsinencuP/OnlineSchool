import {
  GoogleMeetClient,
  isGoogleAccessToken,
  isGoogleMeetResourceName,
} from '../dist/modules/schedule/google-meet/google-meet-client.js';

const mode = process.argv[2];
const owner = process.env.MEET_POC_OWNER_ACCESS_TOKEN;
const observer = process.env.MEET_POC_OTHER_ACCESS_TOKEN;
const name = process.env.MEET_POC_RESOURCE_NAME;
const manualCode = process.env.MEET_POC_MANUAL_CODE;

function emit(value, success) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  if (!success) process.exitCode = 1;
}

function describe(result) {
  return result.ok ? { result: 'OK', privacySettings: result.value.privacySettings } : result.error;
}

async function probe() {
  const create = mode === '--create-test-space';
  if (
    process.argv.length !== 3 ||
    (!create && mode !== '--inspect-test-space') ||
    !isGoogleAccessToken(owner) ||
    !isGoogleAccessToken(observer) ||
    owner === observer ||
    (create ? !!name : !isGoogleMeetResourceName(name)) ||
    (manualCode && !/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(manualCode))
  ) {
    emit({ result: 'INVALID_PROBE_CONFIGURATION' }, false);
    return;
  }
  const client = new GoogleMeetClient();
  const created = create ? await client.createSpace(owner) : null;
  if (created && !created.ok) {
    emit({ create: describe(created) }, false);
    return;
  }
  const spaceName = created?.value.name ?? name;
  const owned = await client.getSpace(owner, spaceName);
  if (!owned.ok) {
    emit({ ...(created ? { create: describe(created) } : {}), ownerRead: describe(owned) }, false);
    return;
  }
  const other = await client.getSpace(observer, spaceName);
  const otherDenied =
    !other.ok && ['PERMISSION_DENIED', 'RESOURCE_NOT_FOUND'].includes(other.error.code);
  const rereadMatches =
    !created ||
    (created.value.name === owned.value.name &&
      created.value.meetingUri === owned.value.meetingUri);
  const manual = manualCode ? await client.checkMeetingCode(owner, manualCode) : null;
  emit(
    {
      checkedAt: new Date().toISOString(),
      ...(created ? { create: describe(created) } : {}),
      ownerRead: describe(owned),
      otherAccountRead: describe(other),
      sameSpaceOnReread: rereadMatches,
      ...(manual ? { manualCodeCheck: describe(manual) } : {}),
    },
    otherDenied && rereadMatches && owned.value.privacySettings === 'DISABLED',
  );
}

await probe();
