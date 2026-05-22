"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
}

// Composant dédié au rendu markdown des messages assistant.
// Volontairement minimal : on garde la typographie du conteneur parent
// et on n'applique de styles que là où il en faut vraiment (code, listes, liens…).
export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-content text-[var(--text-primary)] leading-[1.7] text-[15px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
          h1: ({ children }) => (
            <h1 className="mt-6 mb-3 text-xl font-semibold text-[var(--text-primary)]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 mb-2.5 text-lg font-semibold text-[var(--text-primary)]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-2 text-base font-semibold text-[var(--text-primary)]">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="my-3 list-disc pl-6 space-y-1.5 marker:text-[var(--text-tertiary)]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 list-decimal pl-6 space-y-1.5 marker:text-[var(--text-tertiary)]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-[1.65]">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent-info)] underline underline-offset-2 hover:opacity-80 break-words"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children, className }) => {
            const isBlock = (className ?? "").includes("language-");
            if (isBlock) {
              return (
                <code className="block font-mono text-[13px]">{children}</code>
              );
            }
            return (
              <code className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-soft)] font-mono text-[0.85em] text-[var(--text-primary)]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3 p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] overflow-x-auto text-[13px] leading-relaxed">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-4 border-l-2 border-[var(--border-soft)] text-[var(--text-secondary)] italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-[var(--border-soft)]" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-[var(--border-soft)] py-2 px-3 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-[var(--border-soft)] py-2 px-3 align-top">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
