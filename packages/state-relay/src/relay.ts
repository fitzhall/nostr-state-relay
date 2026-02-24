// packages/state-relay/src/relay.ts
import { SimplePool, type SubscribeManyParams } from 'nostr-tools/pool'
import type { Event as NostrEvent } from 'nostr-tools/core'
import type { Filter } from 'nostr-tools/filter'
import type { StateRelayRelays } from './types'

export class RelayPool {
  private pool: SimplePool
  private relays: StateRelayRelays

  constructor(relays: StateRelayRelays) {
    this.relays = relays
    this.pool = new SimplePool()
  }

  async publish(event: NostrEvent): Promise<PromiseSettledResult<string>[]> {
    const promises = this.pool.publish(this.relays.publish, event)
    return Promise.allSettled(promises)
  }

  async query(filter: Filter): Promise<NostrEvent[]> {
    return this.pool.querySync(this.relays.read, filter)
  }

  subscribe(
    filter: Filter,
    params: Pick<SubscribeManyParams, 'onevent' | 'oneose' | 'onclose'>
  ): () => void {
    const sub = this.pool.subscribeMany(this.relays.read, filter, params)
    return () => sub.close()
  }

  status(): Map<string, boolean> {
    return this.pool.listConnectionStatus()
  }

  destroy(): void {
    this.pool.destroy()
  }
}
