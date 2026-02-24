// packages/state-relay/__tests__/snapshot.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SnapshotManager } from '../src/snapshot'
import {
  STATE_SNAPSHOT_KIND,
  DEFAULT_OPTIONS,
  type StateRelayConfig,
  type SnapshotPayload,
} from '../src/types'

const mockPubkey = 'a'.repeat(64)

function makeConfig(): StateRelayConfig {
  return {
    identity: {
      pubkey: mockPubkey,
      signEvent: vi.fn(async (evt) => ({
        ...evt,
        pubkey: mockPubkey,
        id: 'event-id-123',
        sig: 'sig-abc',
      })),
      encrypt: vi.fn(async (plaintext) => `encrypted:${plaintext}`),
      decrypt: vi.fn(async (ciphertext) => ciphertext.replace('encrypted:', '')),
    },
    relays: {
      publish: ['wss://relay1.test'],
      read: ['wss://relay1.test'],
    },
    app: { name: 'test-app', namespace: 'default', deviceId: 'DEV_test' },
  }
}

function makePayload(rev: number): Record<string, unknown> {
  return { foo: 'bar', rev }
}

describe('SnapshotManager', () => {
  let manager: SnapshotManager
  let config: StateRelayConfig

  beforeEach(() => {
    config = makeConfig()
    manager = new SnapshotManager(config, DEFAULT_OPTIONS)
  })

  it('builds a valid snapshot payload', () => {
    const snapshot = manager.buildPayload(makePayload(1), 1)
    expect(snapshot.schema).toBe('state-relay.snapshot.v1')
    expect(snapshot.app).toBe('test-app')
    expect(snapshot.namespace).toBe('default')
    expect(snapshot.device_id).toBe('DEV_test')
    expect(snapshot.rev).toBe(1)
    expect(snapshot.data.payload).toEqual({ foo: 'bar', rev: 1 })
  })

  it('builds a valid Nostr event from snapshot', async () => {
    const event = await manager.buildEvent(makePayload(1), 1)
    expect(event.kind).toBe(STATE_SNAPSHOT_KIND)
    expect(event.tags).toContainEqual(['d', 'test-app:default'])
    expect(event.tags).toContainEqual(['app', 'test-app'])
    expect(event.tags).toContainEqual(['rev', '1'])
    expect(event.tags).toContainEqual(['device', 'DEV_test'])
    expect(event.tags).toContainEqual(['ver', '1'])
  })

  it('encrypts the snapshot content', async () => {
    const event = await manager.buildEvent(makePayload(1), 1)
    expect(event.content).toMatch(/^encrypted:/)
    expect(config.identity.encrypt).toHaveBeenCalledOnce()
  })

  it('rejects snapshots exceeding max size', async () => {
    const hugePayload: Record<string, unknown> = {
      data: 'x'.repeat(DEFAULT_OPTIONS.maxSnapshotBytes + 1),
    }
    await expect(manager.buildEvent(hugePayload, 1)).rejects.toThrow(/exceeds max/)
  })

  it('resolves conflict: highest rev wins', () => {
    const a = { rev: 5, createdAt: 100, deviceId: 'DEV_a' }
    const b = { rev: 3, createdAt: 200, deviceId: 'DEV_b' }
    expect(manager.resolveConflict(a, b)).toBe('a')
  })

  it('resolves conflict: same rev, newest created_at wins', () => {
    const a = { rev: 5, createdAt: 100, deviceId: 'DEV_a' }
    const b = { rev: 5, createdAt: 200, deviceId: 'DEV_b' }
    expect(manager.resolveConflict(a, b)).toBe('b')
  })

  it('resolves conflict: same rev + time, lexicographic device_id wins', () => {
    const a = { rev: 5, createdAt: 100, deviceId: 'DEV_b' }
    const b = { rev: 5, createdAt: 100, deviceId: 'DEV_a' }
    expect(manager.resolveConflict(a, b)).toBe('b')
  })

  it('parses and decrypts a snapshot event', async () => {
    const event = await manager.buildEvent(makePayload(1), 1)
    // Simulate fetched event with id/pubkey/sig
    const fetched = { ...event, id: 'event-id-123', pubkey: mockPubkey, sig: 'sig-abc' }
    const result = await manager.parseEvent(fetched)
    expect(result.payload.schema).toBe('state-relay.snapshot.v1')
    expect(result.rev).toBe(1)
    expect(result.payload.data.payload).toEqual({ foo: 'bar', rev: 1 })
  })
})
