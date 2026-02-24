// packages/state-relay/__tests__/relay.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RelayPool } from '../src/relay'

// Mock nostr-tools SimplePool
vi.mock('nostr-tools/pool', () => {
  const mockPool = {
    publish: vi.fn(() => [Promise.resolve('ok')]),
    querySync: vi.fn(() => Promise.resolve([])),
    subscribeMany: vi.fn(() => ({ close: vi.fn() })),
    close: vi.fn(),
    destroy: vi.fn(),
    listConnectionStatus: vi.fn(() => new Map([['wss://relay1.test', true]])),
  }
  return { SimplePool: vi.fn(() => mockPool) }
})

describe('RelayPool', () => {
  let pool: RelayPool

  beforeEach(() => {
    pool = new RelayPool({
      publish: ['wss://relay1.test'],
      read: ['wss://relay1.test', 'wss://relay2.test'],
    })
  })

  it('creates with relay config', () => {
    const status = pool.status()
    expect(status).toBeDefined()
  })

  it('publishes to publish relays', async () => {
    const results = await pool.publish({ id: 'test', kind: 1, content: '', created_at: 0, tags: [], pubkey: '', sig: '' })
    expect(results.length).toBeGreaterThan(0)
  })

  it('queries from read relays', async () => {
    const events = await pool.query({ kinds: [30333] })
    expect(Array.isArray(events)).toBe(true)
  })

  it('subscribes and returns unsubscribe function', () => {
    const unsub = pool.subscribe(
      { kinds: [1059] },
      { onevent: () => {} }
    )
    expect(typeof unsub).toBe('function')
  })

  it('cleans up on destroy', () => {
    pool.destroy()
    // Should not throw
  })
})
