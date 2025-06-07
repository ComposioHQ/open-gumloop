"use client";
import React, { useState, useCallback, useEffect, ChangeEvent, useRef } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import ToolsWindow from './ToolsWindow';

// Re-import model options or define them here if needed
const modelOptions = {
  openai: ['gpt-4o', 'gpt-4.1', 'o3-mini'],
  anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  google: ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest', 'gemini-1.0-pro'],
};

// Updated AgentNodeData interface
export interface AgentNodeData {
  label?: string;
  systemPrompt?: string;
  llmApiKey?: string; 
  modelProvider?: 'openai' | 'anthropic' | 'google';
  modelName?: string;
  composioApiKey?: string;
  allowedTools?: string; 
  onNodeDataChange?: (id: string, data: Partial<Omit<AgentNodeData, 'onNodeDataChange'>>) => void;
  width?: number;
}

interface AgentNodeProps extends NodeProps<AgentNodeData> {
  onOpenToolsWindow?: (composioApiKey?: string) => void;
  onCopyFieldToAll?: (field: string, value: string) => void;
  onCopyApiKeyToAllAgents?: (apiKey: string) => void;
}

const AgentNode: React.FC<AgentNodeProps & { _forceRerender?: number }> = ({ id, data, isConnectable, onOpenToolsWindow, onCopyFieldToAll, onCopyApiKeyToAllAgents, _forceRerender }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedActionsList = (data.allowedTools || '').split(',').map(t => t.trim()).filter(Boolean);
  const [localComposioApiKey, setLocalComposioApiKey] = useState(data.composioApiKey || '');

  useEffect(() => {
    setLocalComposioApiKey(data.composioApiKey || '');
  }, [data.composioApiKey]);

  const handleNodeConfigChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    let newData: Partial<AgentNodeData> = { [name]: value };
    if (name === 'modelProvider') {
      const newProvider = value as keyof typeof modelOptions;
      newData.modelName = modelOptions[newProvider]?.[0] || undefined;
    }
    if (name === 'composioApiKey') {
      setLocalComposioApiKey(value);
    }
    if (data.onNodeDataChange) {
      data.onNodeDataChange(id, newData);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [data.systemPrompt]);

  // Common styles
  const inputStyle = {
    width: '100%',
    padding: '0.5rem',
    fontSize: '0.75rem',
    color: '#cbfcfc', // Use agent node color
    background: 'rgba(180, 245, 245, 0.05)',
    border: '1px solid rgba(180, 245, 245, 0.1)',
    borderRadius: '0.375rem',
    outline: 'none',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: '500',
    color: 'rgba(180, 245, 245, 0.7)',
    marginBottom: '0.25rem'
  };

  return (
    <>
      <div style={{
        background: 'rgba(180, 245, 245, 0.1)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(180, 245, 245, 0.2)',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 24px -1px rgba(0, 0, 0, 0.2)',
        minWidth: '16rem',
        maxWidth: '40rem',
        width: 'fit-content',
        color: '#cbfcfc',
        fontSize: '0.85rem',
      }}>
        <div style={{
          padding: '0.5rem',
          borderBottom: '1px solid rgba(180, 245, 245, 0.2)',
        }}>
          <input
            type="text"
            name="label"
            value={data.label ?? 'Agent'}
            onChange={handleNodeConfigChange}
            onPaste={(e) => e.stopPropagation()}
            style={{
              fontSize: '0.85rem',
              fontWeight: '600',
              color: '#cbfcfc',
              background: 'transparent',
              outline: 'none',
              border: 'none',
              width: '100%',
              padding: '0.15rem',
            }}
            className="focus:ring-1 focus:ring-[#cbfcfc] rounded"
            placeholder="Agent Label"
          />
        </div>
        <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* LLM Configuration Section */}
          <div style={{ borderBottom: '1px dashed rgba(180, 245, 245, 0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ ...labelStyle, fontSize: '0.8rem', color: 'rgba(180, 245, 245, 0.9)', marginBottom: '0.3rem' }}>LLM Config</span>
            <div>
              <label htmlFor={`modelProvider-${id}`} style={labelStyle}>Model Provider</label>
              <select
                id={`modelProvider-${id}`}
                name="modelProvider"
                value={data.modelProvider || 'openai'}
                onChange={handleNodeConfigChange}
                style={inputStyle}
                className="focus:ring-1 focus:ring-[#cbfcfc] cursor-pointer"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
              </select>
            </div>
            <div>
              <label htmlFor={`modelName-${id}`} style={labelStyle}>Model Name</label>
              <select
                id={`modelName-${id}`}
                name="modelName"
                value={data.modelName || modelOptions[data.modelProvider || 'openai'][0]}
                onChange={handleNodeConfigChange}
                style={inputStyle}
                className="focus:ring-1 focus:ring-[#cbfcfc] cursor-pointer"
                disabled={!modelOptions[data.modelProvider || 'openai']?.length}
              >
                {(modelOptions[data.modelProvider || 'openai'] || []).map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
                {!(modelOptions[data.modelProvider || 'openai']?.length) && (
                  <option value="" disabled>No models available</option>
                )}
              </select>
            </div>
            <div>
              <label htmlFor={`llmApiKey-${id}`} style={labelStyle}>LLM API Key</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  id={`llmApiKey-${id}`}
                  type="password"
                  name="llmApiKey"
                  value={data.llmApiKey || ''}
                  onChange={handleNodeConfigChange}
                  onPaste={e => { e.stopPropagation(); }}
                  style={inputStyle}
                  className="focus:ring-1 focus:ring-[#cbfcfc]"
                  placeholder="Enter LLM API Key..."
                />
                {data.llmApiKey && onCopyApiKeyToAllAgents && (
                  <button
                    type="button"
                    title="Copy API Key to all Agents"
                    style={{
                      background: 'rgba(255,255,255,0.32)',
                      border: '1.5px solid rgba(0,0,0,0.13)',
                      borderRadius: '0.4rem',
                      padding: '0 0.6rem',
                      marginLeft: '0.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)',
                      backdropFilter: 'blur(8px)',
                      color: '#222',
                      fontSize: '0.95em',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      height: '2.25rem',
                      minHeight: '2.25rem',
                    }}
                    onClick={() => onCopyApiKeyToAllAgents(data.llmApiKey!)}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/><rect x="3" y="3" width="10" height="10" rx="2"/></svg>
                  </button>
                )}
              </div>
            </div>
            <div>
              <label htmlFor={`systemPrompt-${id}`} style={labelStyle}>System Prompt</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <textarea
                  id={`systemPrompt-${id}`}
                  name="systemPrompt"
                  value={data.systemPrompt || ''}
                  onChange={handleNodeConfigChange}
                  onPaste={(e) => e.stopPropagation()}
                  rows={1}
                  ref={textareaRef}
                  style={{ ...inputStyle, resize: 'none', overflow: 'hidden', minHeight: 32, maxHeight: 200, transition: 'height 0.2s' }}
                  className="focus:ring-1 focus:ring-[#cbfcfc]"
                  placeholder="e.g., You are a helpful agent..."
                />
              </div>
            </div>
          </div>
          {/* Tool Configuration Section */}
          <div>
            <span style={{ ...labelStyle, fontSize: '0.8rem', color: 'rgba(180, 245, 245, 0.9)', marginBottom: '0.3rem' }}>Tool Config</span>
            <div style={{ marginBottom: '0.5rem' }}>
              {!data.composioApiKey && (
                <div className="mb-3 flex items-center gap-2 bg-gradient-to-r from-red-500 via-red-600 to-pink-500 text-white rounded-lg px-4 py-2 shadow-lg border border-red-300/40 animate-fade-in">
                  <svg className="w-5 h-5 text-white/90" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" /></svg>
                  <span className="font-medium text-sm">You must provide a <span className="underline">Composio API key</span> to use tools.</span>
                </div>
              )}
              <label htmlFor={`composioApiKey-${id}`} style={labelStyle}>Composio API Key</label>
              <input
                id={`composioApiKey-${id}`}
                type="password"
                name="composioApiKey"
                value={localComposioApiKey}
                onChange={handleNodeConfigChange}
                onPaste={e => { e.stopPropagation(); }}
                style={inputStyle}
                className="focus:ring-1 focus:ring-[#cbfcfc]"
                placeholder="Enter Composio API Key (optional)"
              />
            </div>

            {/* Tools Selection */}
            <div className="relative">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={labelStyle}>Available Actions</label>
              </div>
              <div 
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                className="hover:bg-[rgba(180,245,245,0.08)] focus:bg-[rgba(180,245,245,0.08)] transition-colors duration-150"
              >
                <span style={{ color: 'rgba(180, 245, 245, 0.6)' }}>
                  Select an action...
                </span>
                <svg width="20" height="20" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              
              {showDropdown && (
                <div 
                  className="absolute left-0 right-0 mt-1 bg-[#0a2323] border border-[#cbfcfc33] rounded-md shadow-lg z-20 max-h-48 overflow-y-auto"
                  style={{ fontSize: '0.85em' }}
                >
                  <div
                    className="px-3 py-2 cursor-pointer hover:bg-[#cbfcfc22] text-[#cbfcfc] font-medium border-b border-[#cbfcfc33]"
                    onClick={() => {
                      if (data.composioApiKey !== localComposioApiKey && data.onNodeDataChange) {
                        data.onNodeDataChange(id, { composioApiKey: localComposioApiKey });
                      }
                      if (onOpenToolsWindow) {
                        onOpenToolsWindow(localComposioApiKey);
                      }
                      setShowDropdown(false);
                    }}
                  >
                    + Add Tool
                  </div>
                </div>
              )}
            </div>

            <div 
              className="flex flex-wrap gap-2 mt-2"
            >
              {selectedActionsList.map(actionKey => (
                <div key={actionKey} className="bg-[#cbfcfc22] text-[#cbfcfc] rounded-full px-3 py-1 text-xs flex items-center gap-1.5">
                  <button
                    type="button"
                    className="text-[#cbfcfc] hover:text-white leading-none mr-1.5"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1em', padding: '0'}}
                    onClick={() => {
                      const updated = selectedActionsList.filter(a => a !== actionKey);
                      if (data.onNodeDataChange) data.onNodeDataChange(id, { allowedTools: updated.join(',') });
                    }}
                    aria-label={`Remove ${actionKey}`}
                  >
                    ×
                  </button>
                  {actionKey}
                </div>
              ))}
            </div>
          </div>
        </div>
        <Handle 
          type='target' 
          position={Position.Left} 
          id='input' 
          isConnectable={isConnectable} 
          style={{
            background: '#cbfcfc',
            width: '0.75rem',
            height: '0.75rem',
          }}
        />
        <Handle 
          type='source' 
          position={Position.Right} 
          id='output' 
          isConnectable={isConnectable} 
          style={{
            background: '#cbfcfc',
            width: '0.75rem',
            height: '0.75rem',
          }}
        />
      </div>
    </>
  );
};

export default AgentNode;