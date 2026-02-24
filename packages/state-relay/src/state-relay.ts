// packages/state-relay/src/state-relay.ts
import { EventEmitter } from 'events'
import { RelayPool } from './relay'
import { SnapshotManager } from './snapshot'
import {
  STATE_SNAPSHOT_KIND,
  DEFAULT_OPTIONS,
  type StateRelayConfig,
  type StateRelayOptions,
  type SnapshotResult,
  type RelayStatus,
} from './types'

export class StateRelay extends EventEmitter {
  private config: StateRelayConfig
  private options: StateRelayOptions
  private pool: RelayPool
  private snapshots: SnapshotManager
  private lastPublishedRev: number | null = null
  private lastPublishedEventId: string | null = null
  private subscriptions: Array<() => void> = []

  constructor(config: StateRelayConfig) {
    super()
    this.config = config
    this.options = { ...DEFAULT_OPTIONS, ...config.options }
    this.pool = new RelayPool(config.relays)
    this.snapshots = new SnapshotManager(config, this.options)
  }

  // --- Lifecycle ---

  status(): RelayStatus {
    return {
      connected: this.pool.status(),
      lastPublishedRev: this.lastPublishedRev,
      lastPublishedEventId: this.lastPublishedEventId,
    }
  }

  async destroy(): Promise<void> {
    this.subscriptions.forEach(unsub => unsub())
    this.subscriptions = []
    this.pool.destroy()
    this.removeAllListeners()
  }

  // --- Snapshots ---

  async publishSnapshot(
    data: Record<string, unknown>,
    rev: number,
  ): Promise<{ eventId: string }> {
    const event = await this.snapshots.buildEvent(data, rev)
    await this.pool.publish(event as any)

    this.lastPublishedRev = rev
    this.lastPublishedEventId = event.id
    this.emit('snapshot:published', { eventId: event.id, rev })

    return { eventId: event.id }
  }

  async fetchLatestSnapshot(): Promise<SnapshotResult | null> {
    const dTag = `${this.config.app.name}:${this.config.app.namespace}`
    const events = await this.pool.query({
      kinds: [STATE_SNAPSHOT_KIND],
      authors: [this.config.identity.pubkey],
      '#d': [dTag],
    })

    if (events.length === 0) return null

    const best = this.snapshots.selectBest(events)
    if (!best) return null

    const result = await this.snapshots.parseEvent(best)
    this.emit('snapshot:received', result)
    return result
  }
}
