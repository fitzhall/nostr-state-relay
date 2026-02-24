// packages/state-relay/__tests__/types.test.ts
import { describe, it, expect } from 'vitest'
import {
  STATE_SNAPSHOT_KIND,
  STATE_RECEIPT_KIND,
  DEFAULT_OPTIONS,
  type StateRelayConfig,
  type SnapshotPayload,
  type CommandPayload,
  type ReceiptPayload,
  type SnapshotResult,
} from '../src/types'

describe('types', () => {
  it('exports correct kind numbers', () => {
    expect(STATE_SNAPSHOT_KIND).toBe(30333)
    expect(STATE_RECEIPT_KIND).toBe(30334)
  })

  it('exports default options', () => {
    expect(DEFAULT_OPTIONS.ttl).toBe(300)
    expect(DEFAULT_OPTIONS.retries).toBe(3)
    expect(DEFAULT_OPTIONS.maxSnapshotBytes).toBe(65536)
  })

  it('SnapshotPayload validates schema field', () => {
    const snapshot: SnapshotPayload = {
      schema: 'state-relay.snapshot.v1',
      app: 'test',
      namespace: 'default',
      device_id: 'DEV_test',
      state_id: 'uuid-123',
      rev: 1,
      ts: Math.floor(Date.now() / 1000),
      summary: { health: 'green' },
      data: { payload: { foo: 'bar' } },
    }
    expect(snapshot.schema).toBe('state-relay.snapshot.v1')
    expect(snapshot.rev).toBe(1)
  })

  it('CommandPayload includes ttl field', () => {
    const cmd: CommandPayload = {
      schema: 'state-relay.command.v1',
      cmd_id: 'uuid-456',
      ts: Math.floor(Date.now() / 1000),
      from: 'npub-sender',
      to: 'npub-target',
      namespace: 'test:default',
      action: 'run_drill',
      params: {},
      ttl: 300,
      expect_receipt: true,
    }
    expect(cmd.ttl).toBe(300)
    expect(cmd.action).toBe('run_drill')
  })

  it('ReceiptPayload supports all lifecycle statuses', () => {
    const statuses: ReceiptPayload['status'][] = ['received', 'started', 'completed', 'failed']
    statuses.forEach(status => {
      const receipt: ReceiptPayload = {
        schema: 'state-relay.receipt.v1',
        cmd_id: 'uuid-789',
        status,
        ts: Math.floor(Date.now() / 1000),
      }
      expect(receipt.status).toBe(status)
    })
  })
})
