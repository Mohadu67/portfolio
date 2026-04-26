"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

interface CodeBlockProps {
  code: string;
  lang?: string;
}

export function CodeBlock({ code, lang }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Copié dans le presse-papiers");
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      toast.error("Échec de la copie");
    }
  };

  return (
    <div className="relative group rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] my-3 overflow-hidden">
      {lang && (
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/50 flex items-center justify-between">
          <span>{lang}</span>
        </div>
      )}
      <button
        type="button"
        onClick={copy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--bg-secondary)]/80 backdrop-blur text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 hover:text-[var(--accent-orange)] transition-opacity z-10"
        aria-label="Copier"
        title="Copier"
      >
        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      </button>
      <pre className="px-3 py-3 overflow-x-auto text-xs font-mono text-[var(--text-primary)] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
