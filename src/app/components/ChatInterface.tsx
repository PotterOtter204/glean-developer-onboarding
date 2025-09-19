'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Wrench } from 'lucide-react';
import EnhancedMarkdown  from './EnhancedMarkdown';
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool_call';
  content: string;
  isStreaming?: boolean;
}

export default function ChatInterface() {
const testMarkdown = `
Short answer: run search requests from your FastAPI backend to Glean's Client API (POST /rest/api/v1/search) using a Glean-issued token (user-scoped is recommended), then return/render the results in your app — or embed the Web SDK in the frontend if you want a prebuilt UI. See examples and notes below.\n\n1) Pick the integration style\n- Server-side proxy / API: FastAPI receives user queries, calls Glean's Client API search endpoint, and returns results (good for keeping tokens secret and adding app logic). [source](https://developers.glean.com/api/client-api/search/search)  \n-
`;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

useEffect(() => {
  console.log('messages', messages);
}, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      let currentAssistantId: string | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              // Mark current assistant message as no longer streaming
              if (currentAssistantId) {
                setMessages(prev => prev.map(msg =>
                  msg.id === currentAssistantId ? { ...msg, isStreaming: false } : msg
                ));
              }
              setIsLoading(false);
              return;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'content') {
                // If no assistant message exists or the last assistant finished, start a new one
                if (!currentAssistantId) {
                  currentAssistantId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
                  setMessages(prev => [
                    ...prev,
                    { id: currentAssistantId!, role: 'assistant', content: '', isStreaming: true }
                  ]);
                }
                setMessages(prev => prev.map(msg => msg.id === currentAssistantId ? { ...msg, content: msg.content + parsed.content } : msg));
              } else if (parsed.type === 'tool_call') {
                // Create user-friendly tool call message
                let toolMessage = '';
                const toolName = parsed.tool_name;

                try {
                  if (toolName === 'select_category') {
                    const args = parsed.tool_args ? JSON.parse(parsed.tool_args) : {};
                    const category = args.category || 'documentation';
                    toolMessage = `Searching ${category} documentation`;
                  } else if (toolName === 'load_pages') {
                    const args = parsed.tool_args ? JSON.parse(parsed.tool_args) : {};
                    const urls = args.urls || [];
                    const pageCount = urls.length;
                    if (pageCount === 1) {
                      toolMessage = 'Loading documentation page';
                    } else {
                      toolMessage = `Loading ${pageCount} documentation pages`;
                    }
                  } else {
                    toolMessage = `Using ${toolName}`;
                  }
                } catch {
                  toolMessage = toolName ? `Using ${toolName}` : 'Processing request';
                }

                const toolMsg: Message = {
                  id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
                  role: 'tool_call',
                  content: toolMessage,
                };
                setMessages(prev => [...prev, toolMsg]);
              } else if (parsed.type === 'tool_result') {
                // Do not render tool result content in the UI per requirements; ignore
              } else if (parsed.type === 'error') {
                const errorId = currentAssistantId || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
                if (!currentAssistantId) {
                  setMessages(prev => [...prev, { id: errorId, role: 'assistant', content: '', isStreaming: true }]);
                }
                setMessages(prev => prev.map(msg => msg.id === errorId ? { ...msg, content: `Error: ${parsed.message}`, isStreaming: false } : msg));
                setIsLoading(false);
                return;
              }
            } catch (error) {
              console.error('Error parsing SSE data:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      const errorId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      setMessages(prev => [...prev, { id: errorId, role: 'assistant', content: 'Sorry, there was an error processing your request.', isStreaming: false }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const renderToolCall = (message: string) => (
    <div className="text-gray-500 text-xs flex items-center gap-1">
      <span>{message}...</span>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center w-screen min-h-screen  bg-gray-100">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto md:max-w-4xl md:w-full w-screen px-4 py-6 pb-32">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center text-gray-600 mb-8">
              <Bot className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h2 className="text-lg font-medium mb-2 text-gray-700">Glean Developer Onboarding Assistant</h2>
              <p className="text-sm text-gray-500">Ask me about Glean's APIs, search functionality, or development best practices.</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="mb-6">
            {message.role === 'user' ? (
              <div className="flex justify-end">
                <div className="flex gap-2 max-w-2xl flex-row-reverse">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-600 text-white flex-shrink-0">
                    <User className="w-3 h-3" />
                  </div>
                  <div className="bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200 text-gray-800 text-sm">
                    <div className="">
                      <EnhancedMarkdown content={message.content} />
                      </div>
                  </div>
                </div>
              </div>
            ) : message.role === 'tool_call' ? (
              <div className="flex justify-start">
                <div className="flex gap-2 max-w-3xl">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-400 text-white flex-shrink-0">
                    <Wrench className="w-3 h-3" />
                  </div>
                  <div className="text-xs text-gray-500 py-1">
                    {renderToolCall(message.content)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-start">
                <div className="flex gap-2 max-w-4xl w-full">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-600 text-white flex-shrink-0">
                    <Bot className="w-3 h-3" />
                  </div>
                  <div className="flex-1 text-gray-700 leading-relaxed">
                    {message.content && (
                      <div className="">
                        <EnhancedMarkdown content={message.content} />
                        {message.isStreaming && (
                          <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="fixed bottom-0 left-0 right-0 flex justify-center p-4">
        <div className="w-full max-w-2xl bg-white border border-gray-300 rounded-lg shadow-sm p-3">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me about Glean development..."
                className="w-full resize-none bg-transparent px-0 py-1 focus:outline-none min-h-[40px] max-h-32 text-gray-800 placeholder-gray-500"
                rows={1}
                disabled={isLoading}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className="p-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}