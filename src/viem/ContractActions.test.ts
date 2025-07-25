import { AbiFunction, Secp256k1, Value } from 'ox'
import { Mode } from 'porto'
import { privateKeyToAccount } from 'viem/accounts'
import { getBalance, readContract } from 'viem/actions'
import { describe, expect, test } from 'vitest'

import { getAccount } from '../../test/src/actions.js'
import { exp1Address, exp1Config, getPorto } from '../../test/src/porto.js'
import * as Call from '../core/internal/call.js'
import * as AccountContract from './ContractActions.js'
import * as Key from './Key.js'

describe('execute', () => {
  describe('behavior: authorize', () => {
    test('delegated: false, key: owner, keysToAuthorize: [P256], executor: JSON-RPC', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })
      const { account } = await getAccount(client)

      const key = Key.createHeadlessWebAuthnP256()

      await AccountContract.execute(client, {
        account,
        calls: [
          Call.authorize({
            key,
          }),
        ],
        delegation,
      })

      expect(
        await AccountContract.keyAt(client, {
          account,
          index: 0,
        }),
      ).toEqual({
        expiry: key.expiry,
        hash: key.hash,
        id: key.id,
        prehash: key.prehash,
        publicKey: key.publicKey,
        role: key.role,
        type: 'webauthn-p256',
      })
    })

    test('delegated: true, key: owner, keysToAuthorize: [P256], executor: JSON-RPC', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })
      const { account } = await getAccount(client)

      await AccountContract.execute(client, {
        account,
        calls: [],
        delegation,
      })

      const key = Key.createHeadlessWebAuthnP256()

      await AccountContract.execute(client, {
        account,
        calls: [
          Call.authorize({
            key,
          }),
        ],
      })

      expect(
        await AccountContract.keyAt(client, {
          account,
          index: 0,
        }),
      ).toEqual({
        expiry: key.expiry,
        hash: key.hash,
        id: key.id,
        prehash: key.prehash,
        publicKey: key.publicKey,
        role: key.role,
        type: 'webauthn-p256',
      })
    })

    test('delegated: false, key: owner, keysToAuthorize: [P256], executor: EOA', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })
      const { account, privateKey } = await getAccount(client)

      const key = Key.createHeadlessWebAuthnP256()

      await AccountContract.execute(client, {
        account,
        calls: [
          Call.authorize({
            key,
          }),
        ],
        delegation,
        executor: privateKeyToAccount(privateKey),
      })

      expect(
        await AccountContract.keyAt(client, {
          account,
          index: 0,
        }),
      ).toEqual({
        expiry: key.expiry,
        hash: key.hash,
        id: key.id,
        prehash: key.prehash,
        publicKey: key.publicKey,
        role: key.role,
        type: 'webauthn-p256',
      })
    })

    test('delegated: true, key: owner, keysToAuthorize: [P256], executor: EOA', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })
      const { account, privateKey } = await getAccount(client)

      await AccountContract.execute(client, {
        account,
        calls: [],
        delegation,
      })

      const key = Key.createHeadlessWebAuthnP256()

      await AccountContract.execute(client, {
        account,
        calls: [
          Call.authorize({
            key,
          }),
        ],
        executor: privateKeyToAccount(privateKey),
      })

      expect(
        await AccountContract.keyAt(client, {
          account,
          index: 0,
        }),
      ).toEqual({
        expiry: key.expiry,
        hash: key.hash,
        id: key.id,
        prehash: key.prehash,
        publicKey: key.publicKey,
        role: key.role,
        type: 'webauthn-p256',
      })
    })

    test('key: P256, keysToAuthorize: [P256]', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })
      const { account } = await getAccount(client)

      const key = Key.createHeadlessWebAuthnP256()

      await AccountContract.execute(client, {
        account,
        calls: [
          Call.authorize({
            key,
          }),
        ],
        delegation,
      })

      const nextKey = Key.createHeadlessWebAuthnP256()

      await AccountContract.execute(client, {
        account,
        calls: [
          Call.authorize({
            key: nextKey,
          }),
        ],
        key,
      })

      expect(
        await AccountContract.keyAt(client, {
          account,
          index: 1,
        }),
      ).toEqual({
        expiry: nextKey.expiry,
        hash: nextKey.hash,
        id: nextKey.id,
        prehash: nextKey.prehash,
        publicKey: nextKey.publicKey,
        role: nextKey.role,
        type: 'webauthn-p256',
      })
    })

    test('key: P256, keysToAuthorize: [WebCryptoP256]', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })
      const { account } = await getAccount(client)

      const key = Key.createHeadlessWebAuthnP256()

      await AccountContract.execute(client, {
        account,
        calls: [
          Call.authorize({
            key,
          }),
        ],
        delegation,
      })

      const nextKey = await Key.createWebCryptoP256({
        role: 'session',
      })

      await AccountContract.execute(client, {
        account,
        calls: [
          Call.authorize({
            key: nextKey,
          }),
          Call.setCanExecute({
            enabled: true,
            key: nextKey,
          }),
          Call.setSpendLimit({
            key: nextKey,
            limit: Value.fromEther('1.5'),
            period: 'day',
          }),
        ],
        key,
      })

      expect(
        await AccountContract.keyAt(client, {
          account,
          index: 1,
        }),
      ).toEqual({
        expiry: nextKey.expiry,
        hash: nextKey.hash,
        id: nextKey.id,
        prehash: false,
        publicKey: nextKey.publicKey,
        role: nextKey.role,
        type: 'p256',
      })
    })
  })

  describe('behavior: arbitrary calls', () => {
    test('key: p256, executor: JSON-RPC', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })

      const key = Key.createHeadlessWebAuthnP256()

      const { account } = await getAccount(client, { keys: [key] })

      await AccountContract.execute(client, {
        account,
        calls: [Call.authorize({ key })],
        delegation,
      })

      const alice = privateKeyToAccount(Secp256k1.randomPrivateKey())
      const bob = privateKeyToAccount(Secp256k1.randomPrivateKey())

      const balances_before = await Promise.all([
        getBalance(client, { address: account.address }),
        getBalance(client, { address: alice.address }),
        getBalance(client, { address: bob.address }),
      ])

      expect(balances_before[1]).toEqual(Value.fromEther('0'))
      expect(balances_before[2]).toEqual(Value.fromEther('0'))

      await AccountContract.execute(client, {
        account,
        calls: [
          { to: alice.address, value: Value.fromEther('1') },
          { to: bob.address, value: Value.fromEther('0.5') },
        ],
        key,
      })

      const balances_after = await Promise.all([
        getBalance(client, { address: account.address }),
        getBalance(client, { address: alice.address }),
        getBalance(client, { address: bob.address }),
      ])

      expect(balances_after[0]).not.toBeGreaterThan(
        balances_before[0] - Value.fromEther('1'),
      )
      expect(balances_after[1]).toEqual(Value.fromEther('1'))
      expect(balances_after[2]).toEqual(Value.fromEther('0.5'))
    })

    test('key: p256, executor: JSON-RPC, mint tokens', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })

      const key = Key.createHeadlessWebAuthnP256()

      const { account } = await getAccount(client, { keys: [key] })

      await AccountContract.execute(client, {
        account,
        calls: [Call.authorize({ key })],
        delegation,
      })

      const mint = AbiFunction.encodeData(
        AbiFunction.from('function mint(address,uint256)'),
        [account.address, Value.fromEther('1000')],
      )

      await AccountContract.execute(client, {
        account,
        calls: [{ data: mint, to: exp1Address }],
        key,
      })

      const balance = await readContract(client, {
        ...exp1Config,
        args: [account.address],
        functionName: 'balanceOf',
      })

      expect(balance).toEqual(Value.fromEther('11000'))
    })

    test('key: secp256k1, executor: JSON-RPC', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })

      const key = Key.createSecp256k1()

      const { account } = await getAccount(client, { keys: [key] })

      await AccountContract.execute(client, {
        account,
        calls: [Call.authorize({ key })],
        delegation,
      })

      const alice = privateKeyToAccount(Secp256k1.randomPrivateKey())
      const bob = privateKeyToAccount(Secp256k1.randomPrivateKey())

      const balances_before = await Promise.all([
        getBalance(client, { address: account.address }),
        getBalance(client, { address: alice.address }),
        getBalance(client, { address: bob.address }),
      ])

      expect(balances_before[1]).toEqual(Value.fromEther('0'))
      expect(balances_before[2]).toEqual(Value.fromEther('0'))

      await AccountContract.execute(client, {
        account,
        calls: [
          { to: alice.address, value: Value.fromEther('1') },
          { to: bob.address, value: Value.fromEther('0.5') },
        ],
        key,
      })

      const balances_after = await Promise.all([
        getBalance(client, { address: account.address }),
        getBalance(client, { address: alice.address }),
        getBalance(client, { address: bob.address }),
      ])

      expect(balances_after[0]).not.toBeGreaterThan(
        balances_before[0] - Value.fromEther('1'),
      )
      expect(balances_after[1]).toEqual(Value.fromEther('1'))
      expect(balances_after[2]).toEqual(Value.fromEther('0.5'))
    })

    test('key: webcrypto, executor: JSON-RPC', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })

      const key = await Key.createWebCryptoP256({
        role: 'session',
      })

      const { account } = await getAccount(client, { keys: [key] })

      await AccountContract.execute(client, {
        account,
        calls: [
          Call.authorize({ key }),
          Call.setCanExecute({
            enabled: true,
            key,
          }),
          Call.setSpendLimit({
            key,
            limit: Value.fromEther('1.5'),
            period: 'day',
          }),
        ],
        delegation,
      })

      const alice = privateKeyToAccount(Secp256k1.randomPrivateKey())
      const bob = privateKeyToAccount(Secp256k1.randomPrivateKey())

      const balances_before = await Promise.all([
        getBalance(client, { address: account.address }),
        getBalance(client, { address: alice.address }),
        getBalance(client, { address: bob.address }),
      ])

      expect(balances_before[1]).toEqual(Value.fromEther('0'))
      expect(balances_before[2]).toEqual(Value.fromEther('0'))

      await AccountContract.execute(client, {
        account,
        calls: [
          { to: alice.address, value: Value.fromEther('1') },
          { to: bob.address, value: Value.fromEther('0.5') },
        ],
        key,
      })

      const balances_after = await Promise.all([
        getBalance(client, { address: account.address }),
        getBalance(client, { address: alice.address }),
        getBalance(client, { address: bob.address }),
      ])

      expect(balances_after[0]).not.toBeGreaterThan(
        balances_before[0] - Value.fromEther('1'),
      )
      expect(balances_after[1]).toEqual(Value.fromEther('1'))
      expect(balances_after[2]).toEqual(Value.fromEther('0.5'))
    })

    test('key: owner, executor: JSON-RPC', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })
      const { account } = await getAccount(client)

      await AccountContract.execute(client, {
        account,
        calls: [],
        delegation,
      })

      const alice = privateKeyToAccount(Secp256k1.randomPrivateKey())
      const bob = privateKeyToAccount(Secp256k1.randomPrivateKey())

      const balances_before = await Promise.all([
        getBalance(client, { address: account.address }),
        getBalance(client, { address: alice.address }),
        getBalance(client, { address: bob.address }),
      ])

      expect(balances_before[1]).toEqual(Value.fromEther('0'))
      expect(balances_before[2]).toEqual(Value.fromEther('0'))

      await AccountContract.execute(client, {
        account,
        calls: [
          { to: alice.address, value: Value.fromEther('1') },
          { to: bob.address, value: Value.fromEther('0.5') },
        ],
      })

      const balances_after = await Promise.all([
        getBalance(client, { address: account.address }),
        getBalance(client, { address: alice.address }),
        getBalance(client, { address: bob.address }),
      ])

      expect(balances_after[0]).not.toBeGreaterThan(
        balances_before[0] - Value.fromEther('1'),
      )
      expect(balances_after[1]).toEqual(Value.fromEther('1'))
      expect(balances_after[2]).toEqual(Value.fromEther('0.5'))
    })

    test('key: owner, executor: EOA', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })
      const { account, privateKey } = await getAccount(client)

      await AccountContract.execute(client, {
        account,
        calls: [],
        delegation,
      })

      const alice = privateKeyToAccount(Secp256k1.randomPrivateKey())
      const bob = privateKeyToAccount(Secp256k1.randomPrivateKey())

      const balances_before = await Promise.all([
        getBalance(client, { address: account.address }),
        getBalance(client, { address: alice.address }),
        getBalance(client, { address: bob.address }),
      ])

      expect(balances_before[1]).toEqual(Value.fromEther('0'))
      expect(balances_before[2]).toEqual(Value.fromEther('0'))

      await AccountContract.execute(client, {
        account,
        calls: [
          { to: alice.address, value: Value.fromEther('1') },
          { to: bob.address, value: Value.fromEther('0.5') },
        ],
        executor: privateKeyToAccount(privateKey),
      })

      const balances_after = await Promise.all([
        getBalance(client, { address: account.address }),
        getBalance(client, { address: alice.address }),
        getBalance(client, { address: bob.address }),
      ])

      expect(balances_after[0]).not.toBeGreaterThan(
        balances_before[0] - Value.fromEther('1'),
      )
      expect(balances_after[1]).toEqual(Value.fromEther('1'))
      expect(balances_after[2]).toEqual(Value.fromEther('0.5'))
    })
  })

  // TODO: unskip once Anvil supports reverts on delegated accounts.
  describe.skip('behavior: spend limits', () => {
    test('default', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })

      const key = Key.createHeadlessWebAuthnP256({
        role: 'session',
      })

      const { account } = await getAccount(client, { keys: [key] })

      await AccountContract.execute(client, {
        account,
        calls: [
          Call.authorize({ key }),
          Call.setCanExecute({
            enabled: true,
            key,
          }),
          Call.setSpendLimit({
            key,
            limit: Value.fromEther('1.5'),
            period: 'day',
          }),
        ],
        delegation,
      })

      const alice = privateKeyToAccount(Secp256k1.randomPrivateKey())
      const bob = privateKeyToAccount(Secp256k1.randomPrivateKey())

      const balances_before = await Promise.all([
        getBalance(client, { address: account.address }),
        getBalance(client, { address: alice.address }),
        getBalance(client, { address: bob.address }),
      ])

      expect(balances_before[1]).toEqual(Value.fromEther('0'))
      expect(balances_before[2]).toEqual(Value.fromEther('0'))

      await AccountContract.execute(client, {
        account,
        calls: [
          { to: alice.address, value: Value.fromEther('1') },
          { to: bob.address, value: Value.fromEther('0.5') },
        ],
        key,
      })

      const balances_after = await Promise.all([
        getBalance(client, { address: account.address }),
        getBalance(client, { address: alice.address }),
        getBalance(client, { address: bob.address }),
      ])

      expect(balances_after[0]).not.toBeGreaterThan(
        balances_before[0] - Value.fromEther('1'),
      )
      expect(balances_after[1]).toEqual(Value.fromEther('1'))
      expect(balances_after[2]).toEqual(Value.fromEther('0.5'))

      await expect(() =>
        AccountContract.execute(client, {
          account,
          calls: [
            { to: alice.address, value: Value.fromEther('1') },
            { to: bob.address, value: Value.fromEther('0.5') },
          ],
          key,
        }),
      ).rejects.toThrowError('ExceededSpendLimit')
    })
  })

  // TODO: unskip once Anvil supports reverts on delegated accounts.
  test.skip('error: insufficient funds', async () => {
    const { client, delegation } = getPorto({ mode: Mode.contract })
    const { account } = await getAccount(client)

    await expect(() =>
      AccountContract.execute(client, {
        account,
        calls: [
          {
            to: '0x0000000000000000000000000000000000000000',
            value: Value.fromEther('99999'),
          },
        ],
        delegation,
      }),
    ).rejects.toThrowError('Reason: Unauthorized')
  })

  // TODO: unskip once Anvil supports reverts on delegated accounts.
  test.skip('error: unauthorized', async () => {
    const key = Key.createHeadlessWebAuthnP256({
      role: 'session',
    })

    const { client, delegation } = getPorto({ mode: Mode.contract })
    const { account } = await getAccount(client)

    await AccountContract.execute(client, {
      account,
      calls: [Call.authorize({ key })],
      delegation,
    })

    await AccountContract.execute(client, {
      account,
      calls: [Call.setCanExecute({ enabled: false, key })],
    })

    await expect(() =>
      AccountContract.execute(client, {
        account,
        calls: [{ to: '0x0000000000000000000000000000000000000000' }],
        key,
      }),
    ).rejects.toThrowError('Reason: Unauthorized')
  })

  // TODO: unskip once Anvil supports reverts on delegated accounts.
  test.skip('error: key does not exist ', async () => {
    const { client, delegation } = getPorto({ mode: Mode.contract })
    const { account } = await getAccount(client)

    const key = Key.createHeadlessWebAuthnP256()

    await AccountContract.execute(client, {
      account,
      calls: [],
      delegation,
    })

    await expect(() =>
      AccountContract.execute(client, {
        account,
        calls: [],
        key,
      }),
    ).rejects.toThrowError('Reason: KeyDoesNotExist')
  })
})

describe('prepareExecute', () => {
  describe('authorize', () => {
    test('delegated: false, key: owner, keysToAuthorize: [P256], executor: JSON-RPC', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })
      const { account } = await getAccount(client)

      const keyToAuthorize = Key.createHeadlessWebAuthnP256()

      const { request, digests } = await AccountContract.prepareExecute(
        client,
        {
          account,
          calls: [
            Call.authorize({
              key: keyToAuthorize,
            }),
          ],
          delegation,
        },
      )

      const signatures = {
        auth: digests.auth
          ? await account.sign({ hash: digests.auth })
          : undefined,
        exec: await account.sign({ hash: digests.exec }),
      } as const

      await AccountContract.execute(client, {
        ...request,
        signatures,
      })

      expect(
        await AccountContract.keyAt(client, {
          account,
          index: 0,
        }),
      ).toEqual({
        expiry: keyToAuthorize.expiry,
        hash: keyToAuthorize.hash,
        id: keyToAuthorize.id,
        prehash: keyToAuthorize.prehash,
        publicKey: keyToAuthorize.publicKey,
        role: keyToAuthorize.role,
        type: 'webauthn-p256',
      })
    })

    test('delegated: true, key: owner, keysToAuthorize: [P256], executor: JSON-RPC', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })
      const { account } = await getAccount(client)

      await AccountContract.execute(client, {
        account,
        calls: [],
        delegation,
      })

      const keyToAuthorize = Key.createHeadlessWebAuthnP256()

      const { request, digests } = await AccountContract.prepareExecute(
        client,
        {
          account,
          calls: [
            Call.authorize({
              key: keyToAuthorize,
            }),
          ],
        },
      )

      const signatures = {
        auth: digests.auth
          ? await account.sign({ hash: digests.auth })
          : undefined,
        exec: await account.sign({ hash: digests.exec }),
      } as const

      await AccountContract.execute(client, {
        ...request,
        signatures,
      })

      expect(
        await AccountContract.keyAt(client, {
          account,
          index: 0,
        }),
      ).toEqual({
        expiry: keyToAuthorize.expiry,
        hash: keyToAuthorize.hash,
        id: keyToAuthorize.id,
        prehash: keyToAuthorize.prehash,
        publicKey: keyToAuthorize.publicKey,
        role: keyToAuthorize.role,
        type: 'webauthn-p256',
      })
    })

    test('delegated: false, key: owner, keysToAuthorize: [P256], executor: EOA', async () => {
      const { client, delegation } = getPorto({ mode: Mode.contract })
      const { account, privateKey } = await getAccount(client)

      const keyToAuthorize = Key.createHeadlessWebAuthnP256()

      const { request, digests } = await AccountContract.prepareExecute(
        client,
        {
          account,
          calls: [
            Call.authorize({
              key: keyToAuthorize,
            }),
          ],
          delegation,
          executor: privateKeyToAccount(privateKey),
        },
      )

      const signatures = {
        auth: digests.auth
          ? await account.sign({ hash: digests.auth })
          : undefined,
        exec: await account.sign({ hash: digests.exec }),
      } as const

      await AccountContract.execute(client, {
        ...request,
        signatures,
      })

      expect(
        await AccountContract.keyAt(client, {
          account,
          index: 0,
        }),
      ).toEqual({
        expiry: keyToAuthorize.expiry,
        hash: keyToAuthorize.hash,
        id: keyToAuthorize.id,
        prehash: keyToAuthorize.prehash,
        publicKey: keyToAuthorize.publicKey,
        role: keyToAuthorize.role,
        type: 'webauthn-p256',
      })
    })
  })
})
