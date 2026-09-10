import type { Telemetry } from '../hooks/useChatStream';

interface TelemetryStripProps {
  telemetry: Telemetry | null;
  streaming: boolean;
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: 'flow' | 'gate' | 'muted' }) {
  const color = tone === 'flow' ? 'text-flow' : tone === 'gate' ? 'text-gate' : 'text-text';
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="mono-label text-muted whitespace-nowrap">{label}</span>
      <span className={`font-mono text-xs ${color} truncate`}>{value}</span>
    </div>
  );
}

/** Control-room readout under the transcript: what the edge function reported
 * for the last turn. Values are facts from the stream, not estimates. */
export default function TelemetryStrip({ telemetry, streaming }: TelemetryStripProps) {
  const t = telemetry;
  const ms = (n: number | null | undefined) => (n == null ? '--' : `${n} ms`);
  const tok = (n: number | null | undefined) => (n == null ? '--' : n.toLocaleString());

  const cacheTone = t?.cache === 'hit' ? 'flow' : t?.cache === 'miss' ? 'gate' : 'muted';

  return (
    <div className="border-t border-line pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="mono-label text-muted">TELEMETRY</span>
        <span className={`mono-label ${streaming ? 'text-flow animate-pulse' : 'text-muted'}`}>
          {streaming ? 'STREAMING' : t ? 'IDLE' : 'STANDBY'}
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-3">
        <Cell label="MODEL" value={t?.model ?? '--'} />
        <Cell label="TTFT" value={ms(t?.ttft_ms)} tone={t && t.ttft_ms != null && t.ttft_ms > 1500 ? 'gate' : 'flow'} />
        <Cell label="TOTAL" value={ms(t?.total_ms)} />
        <Cell label="TOKENS IN" value={tok(t?.tokens_in)} />
        <Cell label="TOKENS OUT" value={tok(t?.tokens_out)} />
        <Cell
          label="PROMPT CACHE"
          value={t?.cache ? `${t.cache}${t.cached_tokens_in != null ? ` · ${tok(t.cached_tokens_in)}` : ''}` : '--'}
          tone={cacheTone}
        />
        <Cell label="CORPUS" value={t?.corpus_tokens != null ? `${tok(t.corpus_tokens)} tok` : '--'} />
        <Cell
          label="CONTEXT USED"
          value={t?.context_utilization != null ? `${t.context_utilization}%` : '--'}
          tone={t && t.context_utilization != null && t.context_utilization > 80 ? 'gate' : 'muted'}
        />
      </div>
      {t?.corpus_version && (
        <p className="mono-label text-muted mt-3">CORPUS {t.corpus_version}</p>
      )}
    </div>
  );
}
