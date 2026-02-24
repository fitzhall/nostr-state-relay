// packages/state-relay/src/snapshot.ts
import {
  STATE_SNAPSHOT_KIND,
  type StateRelayConfig,
  type StateRelayOptions,
  type SnapshotPayload,
  type SnapshotResult,
} from './types'
import type { EventTemplate } from 'nostr-tools/pure'

interface ConflictCandidate {
  rev: number
  createdAt: number
  deviceId: string
}

export class SnapshotManager {
  private config: StateRelayConfig
  private options: StateRelayOptions

  constructor(config: StateRelayConfig, options: StateRelayOptions) {
    this.config = config
    this.options = options
  }

  buildPayload(data: Record<string, unknown>, rev: number, prev?: string): SnapshotPayload {
    return {
      schema: 'state-relay.snapshot.v1',
      app: this.config.app.name,
      namespace: this.config.app.namespace,
      device_id: this.config.app.deviceId,
      state_id: crypto.randomUUID(),
      rev,
      prev,
      ts: Math.floor(Date.now() / 1000),
      summary: { health: 'green' },
      data: { payload: data },
    }
  }

  async buildEvent(data: Record<string, unknown>, rev: number, prev?: string) {
    const snapshot = this.buildPayload(data, rev, prev)
    const plaintext = JSON.stringify(snapshot)

    if (new TextEncoder().encode(plaintext).byteLength > this.options.maxSnapshotBytes) {
      throw new Error(
        `Snapshot exceeds max size: ${new TextEncoder().encode(plaintext).byteLength} > ${this.options.maxSnapshotBytes} bytes`
      )
    }

    const encrypted = await this.config.identity.encrypt(plaintext, this.config.identity.pubkey)
    const dTag = `${this.config.app.name}:${this.config.app.namespace}`

    const template: EventTemplate = {
      kind: STATE_SNAPSHOT_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', dTag],
        ['app', this.config.app.name],
        ['ns', this.config.app.namespace],
        ['rev', String(rev)],
        ['device', this.config.app.deviceId],
        ['ver', '1'],
      ],
      content: encrypted,
    }

    return this.config.identity.signEvent(template)
  }

  async parseEvent(event: { content: string; id: string; created_at: number; tags: string[][] }): Promise<SnapshotResult> {
    const decrypted = await this.config.identity.decrypt(event.content, this.config.identity.pubkey)
    const payload = JSON.parse(decrypted) as SnapshotPayload

    if (payload.schema !== 'state-relay.snapshot.v1') {
      throw new Error(`Unsupported snapshot schema: ${payload.schema}`)
    }

    return {
      payload,
      rev: payload.rev,
      eventId: event.id,
      createdAt: event.created_at,
    }
  }

  resolveConflict(a: ConflictCandidate, b: ConflictCandidate): 'a' | 'b' {
    if (a.rev !== b.rev) return a.rev > b.rev ? 'a' : 'b'
    if (a.createdAt !== b.createdAt) return a.createdAt > b.createdAt ? 'a' : 'b'
    return a.deviceId <= b.deviceId ? 'a' : 'b'
  }

  selectBest(events: Array<{ id: string; content: string; created_at: number; tags: string[][] }>): typeof events[number] | null {
    if (events.length === 0) return null
    if (events.length === 1) return events[0]

    return events.reduce((best, current) => {
      const bestRev = parseInt(best.tags.find(t => t[0] === 'rev')?.[1] ?? '0', 10)
      const currentRev = parseInt(current.tags.find(t => t[0] === 'rev')?.[1] ?? '0', 10)
      const bestDevice = best.tags.find(t => t[0] === 'device')?.[1] ?? ''
      const currentDevice = current.tags.find(t => t[0] === 'device')?.[1] ?? ''

      const winner = this.resolveConflict(
        { rev: bestRev, createdAt: best.created_at, deviceId: bestDevice },
        { rev: currentRev, createdAt: current.created_at, deviceId: currentDevice },
      )
      return winner === 'a' ? best : current
    })
  }
}
