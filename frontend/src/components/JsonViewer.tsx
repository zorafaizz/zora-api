import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, FileJson, ListTree, ShieldCheck } from 'lucide-react';

interface JsonViewerProps {
  formattedText: string;
  parsedValue: unknown;
  headers?: Array<[string, string]>;
  status?: number | null;
  durationMs?: number | null;
  byteLength?: number | null;
  truncated?: boolean;
  maxHeightClass?: string;
}

interface JsonNodeProps {
  name?: string;
  value: unknown;
  depth: number;
}

const JsonTreeNode: React.FC<JsonNodeProps> = ({ name, value, depth }) => {
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);
  const [expanded, setExpanded] = useState(depth < 2);

  if (!isObject) {
    let valClass = 'text-celestial-primary';
    let rendered = String(value);
    if (typeof value === 'string') {
      valClass = 'text-celestial-secondary';
      rendered = `"${value}"`;
    } else if (typeof value === 'number') {
      valClass = 'font-medium text-celestial-sky';
    } else if (typeof value === 'boolean') {
      valClass = 'font-semibold text-celestial-lilac';
    } else if (value === null) {
      valClass = 'text-celestial-muted italic';
      rendered = 'null';
    }

    return (
      <div className="flex flex-wrap items-baseline gap-1.5 py-0.5 font-mono text-xs leading-relaxed">
        {name !== undefined && (
          <span className="text-celestial-secondary">&quot;{name}&quot;:</span>
        )}
        <span className={`break-all ${valClass}`}>{rendered}</span>
      </div>
    );
  }

  const entries = isArray
    ? (value as unknown[]).map((v, idx) => [String(idx), v] as const)
    : Object.entries(value as Record<string, unknown>);
  const bracketOpen = isArray ? '[' : '{';
  const bracketClose = isArray ? ']' : '}';

  return (
    <div className="font-mono text-xs leading-relaxed">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-celestial-sky/10"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-celestial-sky" strokeWidth={1.5} />
        ) : (
          <ChevronRight className="h-3 w-3 text-celestial-muted" strokeWidth={1.5} />
        )}
        {name !== undefined && (
          <span className="text-celestial-secondary">&quot;{name}&quot;:</span>
        )}
        <span className="text-celestial-muted">
          {bracketOpen}
          {!expanded && (
            <span className="mx-1 text-[11px] text-celestial-sky">
              {entries.length} {isArray ? 'items' : 'keys'}
            </span>
          )}
          {!expanded && bracketClose}
        </span>
      </button>

      {expanded && (
        <div className="ml-3.5 border-l border-celestial-border/35 pl-3">
          {entries.length === 0 ? (
            <div className="py-0.5 text-celestial-muted italic">empty</div>
          ) : (
            entries.slice(0, 150).map(([k, v]) => (
              <JsonTreeNode
                key={k}
                name={isArray ? undefined : k}
                value={v}
                depth={depth + 1}
              />
            ))
          )}
          {entries.length > 150 && (
            <div className="py-1 text-[11px] text-celestial-muted">
              … {entries.length - 150} additional entries omitted in tree view (switch to Raw JSON)
            </div>
          )}
        </div>
      )}
      {expanded && <div className="pl-2 text-celestial-muted">{bracketClose}</div>}
    </div>
  );
};

export const JsonViewer: React.FC<JsonViewerProps> = ({
  formattedText,
  parsedValue,
  headers = [],
  status,
  durationMs,
  byteLength,
  truncated = false,
  maxHeightClass = 'max-h-[420px]',
}) => {
  const [tab, setTab] = useState<'tree' | 'raw' | 'headers'>('tree');
  const [copied, setCopied] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  const hasStructuredJson = useMemo(
    () => parsedValue !== null && parsedValue !== undefined && typeof parsedValue === 'object',
    [parsedValue]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedText || '');
      setCopyMessage('Response copied.');
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      setCopyMessage('Could not copy the response. Select and copy it manually.');
    }
  };

  const statusTone =
    status == null
      ? 'border-celestial-border/45 text-celestial-muted'
      : status >= 200 && status < 300
        ? 'border-celestial-primary/45 bg-celestial-primary/10 text-celestial-primary'
        : status >= 400
          ? 'border-celestial-primary/65 bg-celestial-elevated text-celestial-primary'
          : 'border-celestial-border bg-celestial-elevated text-celestial-secondary';

  return (
    <div className="celestial-card flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-celestial-border/40 bg-celestial-canvas/55 px-3.5 py-2.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab('tree')}
            disabled={!hasStructuredJson}
            aria-pressed={tab === 'tree' && hasStructuredJson}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
              tab === 'tree' && hasStructuredJson
                ? 'bg-celestial-sky/20 text-celestial-primary'
                : 'text-celestial-muted hover:text-celestial-primary disabled:opacity-40'
            }`}
          >
            <ListTree className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Tree</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('raw')}
            aria-pressed={tab === 'raw' || (!hasStructuredJson && tab !== 'headers')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
              tab === 'raw' || (!hasStructuredJson && tab !== 'headers')
                ? 'bg-celestial-sky/20 text-celestial-primary'
                : 'text-celestial-muted hover:text-celestial-primary'
            }`}
          >
            <FileJson className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Raw JSON</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('headers')}
            aria-pressed={tab === 'headers'}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
              tab === 'headers'
                ? 'bg-celestial-sky/20 text-celestial-primary'
                : 'text-celestial-muted hover:text-celestial-primary'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Headers ({headers.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          {status != null && (
            <span className={`rounded border px-2 py-0.5 font-medium ${statusTone}`}>
              HTTP {status}
            </span>
          )}
          {durationMs != null && (
            <span className="text-celestial-muted">{durationMs} ms</span>
          )}
          {byteLength != null && (
            <span className="hidden text-celestial-muted sm:inline">
              {(byteLength / 1024).toFixed(2)} KB
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            disabled={!formattedText}
            className="inline-flex items-center gap-1 rounded-md border border-celestial-border/45 bg-celestial-surface/60 px-2.5 py-1 text-celestial-secondary transition-colors hover:border-celestial-sky/50 hover:text-celestial-primary disabled:opacity-40"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-celestial-primary" strokeWidth={1.5} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <p role="status" className={copyMessage ? 'px-4 pt-2 text-xs text-celestial-secondary' : 'sr-only'}>{copyMessage}</p>

      {truncated && (
        <div className="border-b border-celestial-border bg-celestial-elevated px-3.5 py-1.5 font-mono text-[11px] text-celestial-secondary">
          Stream shield capped output at 1.00 MB to keep browser memory responsive.
        </div>
      )}

      {/* Body */}
      <div className={`overflow-auto p-4 ${maxHeightClass}`}>
        {!formattedText ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileJson className="h-7 w-7 text-celestial-muted opacity-60" strokeWidth={1.5} />
            <p className="mt-2 font-mono text-xs text-celestial-muted">
              Dispatch a request to inspect live JSON envelope, latency, and response headers.
            </p>
          </div>
        ) : tab === 'headers' ? (
          <div className="space-y-1.5 font-mono text-xs">
            {headers.length === 0 ? (
              <p className="text-celestial-muted">No headers captured.</p>
            ) : (
              headers.map(([k, v]) => (
                <div
                  key={k}
                  className="flex flex-col gap-0.5 border-b border-celestial-border/25 pb-1.5 sm:flex-row sm:gap-3"
                >
                  <span className="min-w-[180px] font-medium text-celestial-sky">{k}:</span>
                  <span className="break-all text-celestial-secondary">{v}</span>
                </div>
              ))
            )}
          </div>
        ) : tab === 'tree' && hasStructuredJson ? (
          <JsonTreeNode value={parsedValue} depth={0} />
        ) : (
          <pre tabIndex={0} className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-celestial-primary">
            {formattedText}
          </pre>
        )}
      </div>
    </div>
  );
};
