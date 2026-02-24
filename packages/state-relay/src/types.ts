// packages/state-relay/src/types.ts
import type { EventTemplate, VerifiedEvent } from 'nostr-tools/pure'

// --- Kind Numbers (experimental, pending NIP draft) ---

export const STATE_SNAPSHOT_KIND = 30333
export const STATE_RECEIPT_KIND = 30334

// --- Config ---

export interface StateRelayIdentity {
  pubkey: string
  signEvent: (evt: EventTemplate) => Promise<VerifiedEvent>
  encrypt: (plaintext: string, pubkey: string) => Promise<string>
  decrypt: (ciphertext: string, pubkey: string) => Promise<string>
}

export interface StateRelayRelays {
  publish: string[]
  read: string[]
}

export interface StateRelayApp {
  name: string
  namespace: string
  deviceId: string
}

export interface StateRelayOptions {
  ttl: number
  retries: number
  maxSnapshotBytes: number
}

export const DEFAULT_OPTIONS: StateRelayOptions = {
  ttl: 300,
  retries: 3,
  maxSnapshotBytes: 65536,
}

export interface StateRelayConfig {
  identity: StateRelayIdentity
  relays: StateRelayRelays
  app: StateRelayApp
  options?: Partial<StateRelayOptions>
}

// --- Snapshot ---

export interface SnapshotPayload {
  schema: 'state-relay.snapshot.v1'
  app: string
  namespace: string
  device_id: string
  state_id: string
  rev: number
  prev?: string
  ts: number
  summary: {
    health: 'green' | 'yellow' | 'red'
    notes?: string
  }
  data: {
    payload: Record<string, unknown>
  }
}

export interface SnapshotResult {
  payload: SnapshotPayload
  rev: number
  eventId: string
  createdAt: number
}

// --- Command ---

export interface CommandPayload {
  schema: 'state-relay.command.v1'
  cmd_id: string
  ts: number
  from: string
  to: string
  namespace: string
  action: string
  params: Record<string, unknown>
  ttl: number
  expect_receipt: boolean
}

export interface CommandContext {
  ack(): Promise<void>
  complete(result?: Record<string, unknown>): Promise<void>
  fail(reason?: string): Promise<void>
}

// --- Receipt ---

export type ReceiptStatus = 'received' | 'started' | 'completed' | 'failed'

export interface ReceiptPayload {
  schema: 'state-relay.receipt.v1'
  cmd_id: string
  status: ReceiptStatus
  ts: number
  result?: Record<string, unknown>
  state_ref?: {
    kind: number
    d: string
    rev: number
    event_id?: string
  }
}

// --- Relay Status ---

export interface RelayStatus {
  connected: Map<string, boolean>
  lastPublishedRev: number | null
  lastPublishedEventId: string | null
}

// --- Events ---

export type StateRelayEventMap = {
  'snapshot:published': { eventId: string; rev: number }
  'snapshot:received': SnapshotResult
  'command:sent': { cmdId: string; action: string; to: string }
  'command:received': CommandPayload
  'command:unacknowledged': { cmdId: string; action: string; to: string }
  'receipt:received': ReceiptPayload
  'relay:connected': string
  'relay:error': { url: string; error: Error }
}
