// packages/state-relay/__tests__/state-relay.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StateRelay } from '../src/state-relay'
import { STATE_SNAPSHOT_KIND, type StateRelayConfig } from '../src/types'

// Mock the relay pool
vi.mock('nostr-tools/pool', () => {
  const mockPool = {
    publish: vi.fn(() => [Promise.resolve('ok')]),
    querySync: vi.fn(() => Promise.resolve([])),
    subscribeMany: vi.fn(() => ({ close: vi.fn() })),
    close: vi.fn(),
    destroy: vi.fn(),
    listConnectionStatus: vi.fn(() => new Map()),
  }
  return { SimplePool: vi.fn(() => mockPool) }
})

const mockPubkey = 'a'.repeat(64)

function makeConfig(): StateRelayConfig {
  return {
    identity: {
      pubkey: mockPubkey,
      signEvent: vi.fn(async (evt) => ({
        ...evt,
        pubkey: mockPubkey,
        id: 'event-' + Math.random().toString(36).slice(2),
        sig: 'sig-abc',
      })),
      encrypt: vi.fn(async (plaintext) => `enc:${plaintext}`),
      decrypt: vi.fn(async (ciphertext) => ciphertext.replace('enc:', '')),
    },
    relays: {
      publish: ['wss://relay1.test'],
      read: ['wss://relay1.test'],
    },
    app: { name: 'test', namespace: 'default', deviceId: 'DEV_test' },
  }
}

describe('StateRelay', () => {
  let relay: StateRelay

  beforeEach(() => {
    relay = new StateRelay(makeConfig())
  })

  it('creates without throwing', () => {
    expect(relay).toBeDefined()
  })

  it('reports status', () => {
    const status = relay.status()
    expect(status).toHaveProperty('connected')
    expect(status).toHaveProperty('lastPublishedRev')
    expect(status).toHaveProperty('lastPublishedEventId')
  })

  it('publishes a snapshot', async () => {
    const result = await relay.publishSnapshot({ key: 'value' }, 1)
    expect(result).toHaveProperty('eventId')
  })

  it('emits snapshot:published after publishing', async () => {
    const handler = vi.fn()
    relay.on('snapshot:published', handler)
    await relay.publishSnapshot({ key: 'value' }, 1)
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ rev: 1 })
    )
  })

  it('fetches latest snapshot (returns null when empty)', async () => {
    const result = await relay.fetchLatestSnapshot()
    expect(result).toBeNull()
  })

  it('destroys cleanly', async () => {
    await relay.destroy()
    // Should not throw
  })
})
