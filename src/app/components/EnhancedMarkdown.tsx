'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

interface EnhancedMarkdownProps {
  content: string;
  className?: string;
}

export default function EnhancedMarkdown({ content, className = '' }: EnhancedMarkdownProps) {
  return (
    <div className={`prose  max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={{
          // Code blocks
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            // Check if this is an inline code block by checking if it has a parent paragraph
            const isInline = !className || !className.includes('language-');

            if (isInline) {
              return (
                <code
                  className="bg-gray-100 text-red-600 px-1 px-0.5 rounded text-xs font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <div className="relative">
                {language && (
                  <div className="absolute top-0 right-0 bg-gray-200 text-gray-600 text-xs px-2 px-1 rounded-bl">
                    {language}
                  </div>
                )}
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                  <code className="text-sm font-mono text-gray-800" {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          },

          // Headings
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-gray-900  border-b border-gray-200 pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-gray-900 mr-3 mx-5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-medium text-gray-900 mr-2 mx-4">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-medium text-gray-900 mr-2 mx-3">
              {children}
            </h4>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="text-gray-700  leading-relaxed">
              {children}
            </p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-gray-700">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-700">
              {children}
            </li>
          ),

          // Links
          a: ({ href, children }) => {
            // Check if this is a source link
            const isSourceLink = children && 
              typeof children === 'string' && 
              children.toLowerCase().includes('source');
            
            if (isSourceLink && href) {
              // Create a very short truncated version of the URL for display
              const url = new URL(href);
              const fullUrl = url.hostname + url.pathname;
              const truncatedUrl = fullUrl.length > 8 ? 
                fullUrl.substring(0, 5) + '...' : 
                fullUrl;
              
              return (
                <sup className="ml-1">
                  <a
                    href={href}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors border border-blue-200 no-underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    title={href}
                  >
                    <span className="mr-1">🔗</span>
                    {truncatedUrl}
                  </a>
                </sup>
              );
            }
            
            // Regular links
            return (
              <a
                href={href}
                className="text-blue-600 hover:text-blue-800 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 px-2 my-4 italic text-gray-600 bg-gray-50">
              {children}
            </blockquote>
          ),

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border border-gray-200 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-200">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr>
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 px-2 text-sm text-gray-700 border-b border-gray-200">
              {children}
            </td>
          ),

          // Horizontal rules
          hr: () => (
            <hr className="my-6 border-t border-gray-200" />
          ),

          // Strong/Bold
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">
              {children}
            </strong>
          ),

          // Emphasis/Italic
          em: ({ children }) => (
            <em className="italic text-gray-700">
              {children}
            </em>
          ),

          // Strikethrough
          del: ({ children }) => (
            <del className="line-through text-gray-500">
              {children}
            </del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}