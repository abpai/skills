export interface WebhookEvent {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
}

export interface Endpoint {
  url: string;
  secret: string;
}

export interface OutgoingRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export type Send = (req: OutgoingRequest) => Promise<{ status: number }>;

export interface DeliveryResult {
  ok: boolean;
  status?: number;
  attempts: number;
  error?: string;
}
