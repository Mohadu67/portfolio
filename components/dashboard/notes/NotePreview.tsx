"use client";

import { CodeBlock } from "./CodeBlock";

interface NotePreviewProps {
  content: string;
}

interface Block {
  kind: "text" | "code";
  content: string;
  lang?: string;
}

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const fenceRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ kind: "text", content: content.slice(lastIndex, match.index) });
    }
    blocks.push({ kind: "code", content: match[2], lang: match[1] || undefined });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    blocks.push({ kind: "text", content: content.slice(lastIndex) });
  }
  if (blocks.length === 0) {
    blocks.push({ kind: "text", content });
  }
  return blocks;
}

function renderInline(text: string): (string | React.ReactElement)[] {
  // Inline code
  const parts: (string | React.ReactElement)[] = [];
  const inlineCodeRegex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <code
        key={`ic-${match.index}`}
        className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--accent-orange)] text-[0.85em] font-mono"
      >
        {match[1]}
      </code>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function renderText(text: string) {
  const lines = text.split("\n");
  const out: React.ReactElement[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Heading
    if (trimmed.startsWith("# ")) {
      out.push(
        <h2 key={`h-${i}`} className="text-xl font-bold text-[var(--text-primary)] mt-4 mb-2">
          {renderInline(trimmed.slice(2))}
        </h2>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      out.push(
        <h3 key={`h-${i}`} className="text-lg font-semibold text-[var(--text-primary)] mt-3 mb-2">
          {renderInline(trimmed.slice(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("### ")) {
      out.push(
        <h4 key={`h-${i}`} className="text-base font-semibold text-[var(--text-primary)] mt-2 mb-1.5">
          {renderInline(trimmed.slice(4))}
        </h4>
      );
      i++;
      continue;
    }

    // Bullet list
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      out.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2 text-sm text-[var(--text-secondary)]">
          {items.map((it, k) => (
            <li key={k}>{renderInline(it)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Empty line
    if (trimmed === "") {
      out.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // Paragraph
    out.push(
      <p key={`p-${i}`} className="text-sm text-[var(--text-secondary)] leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }
  return out;
}

export function NotePreview({ content }: NotePreviewProps) {
  if (!content.trim()) {
    return (
      <p className="text-sm text-[var(--text-tertiary)] italic">
        Cette note est vide. Bascule en mode édition pour ajouter du contenu.
      </p>
    );
  }
  const blocks = parseBlocks(content);
  return (
    <div className="space-y-1">
      {blocks.map((b, i) =>
        b.kind === "code" ? (
          <CodeBlock key={i} code={b.content} lang={b.lang} />
        ) : (
          <div key={i}>{renderText(b.content)}</div>
        )
      )}
    </div>
  );
}
