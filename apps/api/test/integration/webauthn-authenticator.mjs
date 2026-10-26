import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';

const hash = (value) => createHash('sha256').update(value).digest();
const encode = (value) => Buffer.from(value).toString('base64url');
// Synthetic CTAP2 wire messages. The real server verifier validates CBOR, RP hash, UV and ECDSA.
export function authenticator() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' }),
    id = randomBytes(32);
  const cose = isoCBOR.encode(
    new Map([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x, 'base64url')],
      [-3, Buffer.from(jwk.y, 'base64url')],
    ]),
  );
  const count = (value) => {
    const data = Buffer.alloc(4);
    data.writeUInt32BE(value);
    return data;
  };
  function client(type, options, origin, extra = {}) {
    return encode(
      Buffer.from(
        JSON.stringify({
          type,
          challenge: options.challenge,
          origin,
          crossOrigin: false,
          ...extra,
        }),
      ),
    );
  }
  return {
    id: encode(id),
    registration(
      start,
      {
        origin = 'https://qa.school.test',
        rpId = start.options.rp.id,
        uv = true,
        counter = 0,
      } = {},
    ) {
      const options = start.options,
        data = client('webauthn.create', options, origin);
      const length = Buffer.alloc(2);
      length.writeUInt16BE(id.length);
      const authData = Buffer.concat([
        hash(rpId),
        Buffer.from([uv ? 0x45 : 0x41]),
        count(counter),
        Buffer.alloc(16),
        length,
        id,
        Buffer.from(cose),
      ]);
      const attestation = isoCBOR.encode(
        new Map([
          ['fmt', 'none'],
          ['attStmt', new Map()],
          ['authData', authData],
        ]),
      );
      return {
        challengeId: start.challengeId,
        response: {
          id: encode(id),
          rawId: encode(id),
          type: 'public-key',
          clientExtensionResults: {},
          response: {
            clientDataJSON: data,
            attestationObject: encode(attestation),
            transports: ['internal'],
          },
        },
      };
    },
    authentication(
      start,
      {
        origin = 'https://qa.school.test',
        rpId = start.options.rpId,
        uv = true,
        counter = 1,
        userHandle,
        wrongSignature = false,
      } = {},
    ) {
      const data = client('webauthn.get', start.options, origin);
      const authData = Buffer.concat([hash(rpId), Buffer.from([uv ? 5 : 1]), count(counter)]);
      const signature = sign(
        'sha256',
        Buffer.concat([authData, hash(Buffer.from(data, 'base64url'))]),
        privateKey,
      );
      if (wrongSignature) signature[0] ^= 1;
      return {
        challengeId: start.challengeId,
        response: {
          id: encode(id),
          rawId: encode(id),
          type: 'public-key',
          clientExtensionResults: {},
          response: {
            clientDataJSON: data,
            authenticatorData: encode(authData),
            signature: encode(signature),
            ...(userHandle ? { userHandle } : {}),
          },
        },
      };
    },
  };
}
