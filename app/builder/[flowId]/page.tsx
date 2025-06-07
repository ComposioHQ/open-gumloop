"use client"

import React, { useState, useCallback, DragEvent, useMemo, useEffect, useRef } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  addEdge,
  Node,
  Edge,
  Connection,
  ReactFlowInstance,
  useNodesState,
  useEdgesState,
  NodeTypes,
  XYPosition,
  MarkerType,
  NodeDragHandler,
  NodeChange,
  EdgeChange,
  SelectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import ReactMarkdown from 'react-markdown';
import InputNode, { InputNodeData } from '@/components/builder-nodes/InputNode';
import OutputNode from '@/components/builder-nodes/OutputNode';
import LLMNode, { LLMNodeData } from '@/components/builder-nodes/LLMNode';
import ComposioNode, { ComposioNodeData } from '@/components/builder-nodes/ComposioNode';
import AgentNode, { AgentNodeData } from '@/components/builder-nodes/AgentNode';
import { MessageSquare, BrainCircuit, Puzzle, ArrowRightCircle, DownloadCloud, PanelLeftOpen, PanelRightOpen, PanelLeftClose, PanelRightClose, Trash2, Group, Share2, Upload, Loader2 } from 'lucide-react';
import { Squares } from '@/components/ui/squares-background';
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AugmentedLLMPattern from '@/components/workflow-patterns/AugmentedLLMPattern';
import PromptChainingPattern from '@/components/workflow-patterns/PromptChainingPattern';
import RoutingPattern from '@/components/workflow-patterns/RoutingPattern';
import ParallelisationPattern from '@/components/workflow-patterns/ParallelisationPattern';
import EvaluatorOptimiserPattern from '@/components/workflow-patterns/EvaluatorOptimiserPattern';
import { Input } from '@/components/ui/input';
import PatternMetaNode from '@/components/builder-nodes/PatternMetaNode';
import FlowingEdge from '@/components/builder-nodes/FlowingEdge';
import ToolsWindow from '@/components/builder-nodes/ToolsWindow';
import OnboardingTutorial from '@/app/dashboard/onboarding/OnboardingTutorial';
import Joyride from 'react-joyride';
import AgentBuilder from '@/components/builder-nodes/AgentBuilder';

interface OnboardingTutorialProps {
  onComplete: () => void;
}

export default function BuilderPage() {
  "use client";

// Helper function to create a unique ID
const getUniqueNodeId = (type: string) => `${type}_${Math.random().toString(36).substr(2, 9)}`;

// localStorage keys
const LOCAL_STORAGE_NODES_KEY = 'reactFlowNodes';
const LOCAL_STORAGE_EDGES_KEY = 'reactFlowEdges';

// Define modelOptions before it's used in sidebarNodeTypes
const modelOptions = {
  openai: ['gpt-4o', 'gpt-4.1', 'o3-mini'],
  anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  google: ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest', 'gemini-1.0-pro'],
};

// Sidebar item configuration
const sidebarNodeTypes = [
  { type: 'customInput', label: 'Input Node', icon: <MessageSquare size={18} /> , defaultData: { label: 'Start Query', query: '' } },
  { type: 'llm', label: 'LLM Node', icon: <BrainCircuit size={18} />, defaultData: { label: 'LLM Call', systemPrompt: '', apiKey: '' } },
  { type: 'composio', label: 'Composio Tool', icon: <Puzzle size={18} />, defaultData: { label: 'Composio Action', apiKey: '', toolAction: '' } },
  { type: 'customOutput', label: 'Output Node', icon: <ArrowRightCircle size={18} />, defaultData: { label: 'End Result' } },
  { type: 'agent', label: 'Agent Node', icon: <Group size={18} />, 
    defaultData: { 
      label: 'Agent', 
      modelProvider: 'openai', 
      modelName: modelOptions.openai[0], // Use modelOptions here
      systemPrompt: '', 
      llmApiKey: '', 
      composioApiKey: '', 
      allowedTools: '' 
    } 
  },
];

const allSidebarItems = [
  ...sidebarNodeTypes.map(n => ({
    key: n.type,
    label: n.label,
    icon: n.icon,
    description: n.type === 'customInput' ? 'Start your flow with user input' :
                 n.type === 'llm' ? 'Process with AI language model' :
                 n.type === 'composio' ? 'Execute specific actions' :
                 n.type === 'customOutput' ? 'Display final results' :
                 n.type === 'agent' ? 'LLM agent with tool access' : '',
    dragType: 'node',
    dragData: { nodeType: n.type, nodeLabel: n.label, initialData: n.defaultData },
  })),
  {
    key: 'augmented-llm',
    label: 'Augmented LLM',
    icon: <span className="text-lg font-bold text-[#fff5f5]">A</span>,
    description: 'Input → LLM+Tools → Output',
    dragType: 'pattern',
    dragData: { pattern: 'augmented-llm' },
  },
  {
    key: 'prompt-chaining',
    label: 'Prompt Chaining',
    icon: <span className="text-lg font-bold text-[#fff5f5]">C</span>,
    description: 'Input → Agent 1 → Agent 2 → Output',
    dragType: 'pattern',
    dragData: { pattern: 'prompt-chaining' },
  },
  {
    key: 'routing',
    label: 'Routing',
    icon: <span className="text-lg font-bold text-[#fff5f5]">R</span>,
    description: 'Input → Router → Agent 1/2 → Output',
    dragType: 'pattern',
    dragData: { pattern: 'routing' },
  },
  {
    key: 'parallelisation',
    label: 'Parallelisation',
    icon: <span className="text-lg font-bold text-[#fff5f5]">P</span>,
    description: 'Input → Agents (parallel) → Aggregator → Output',
    dragType: 'pattern',
    dragData: { pattern: 'parallelisation' },
  },
  {
    key: 'evaluator-optimiser',
    label: 'Evaluator-Optimiser',
    icon: <span className="text-lg font-bold text-[#fff5f5]">E</span>,
    description: 'Input → Generator → Evaluator (loop) → Output',
    dragType: 'pattern',
    dragData: { pattern: 'evaluator-optimiser' },
  },
];

  const [initialNodesLoaded, setInitialNodesLoaded] = useState(false);
  const [initialEdgesLoaded, setInitialEdgesLoaded] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [serializedGraph, setSerializedGraph] = useState<string | null>(null);
  const [isAgentRunning, setIsAgentRunning] = useState(false);

  // State for sidebar visibility
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);

  // Track selected nodes
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [clipboardNodes, setClipboardNodes] = useState<Node[] | null>(null);

  // History state
  const [history, setHistory] = useState<{nodes: Node[], edges: Edge[]}[]>([]);

  // Ref for hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  const params = useParams();
  const flowId = params?.flowId as string;
  const [flowName, setFlowName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [backLoading, setBackLoading] = useState(false);

  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const filteredSidebarItems = allSidebarItems.filter(item =>
    item.label.toLowerCase().includes(search.toLowerCase()) ||
    item.description.toLowerCase().includes(search.toLowerCase())
  );

  const [dropAsMetaNode, setDropAsMetaNode] = useState(false);

  const [toolsWindowOpen, setToolsWindowOpen] = useState(false);
  const [currentComposioApiKey, setCurrentComposioApiKey] = useState('');

  // Add state for tutorial
  const [showTutorial, setShowTutorial] = useState(false);

  const [runJoyride, setRunJoyride] = useState(false);

  const onNodeDataChange = useCallback(
    (id: string, newData: Partial<InputNodeData | LLMNodeData | ComposioNodeData | AgentNodeData>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, ...newData, _forceRerender: Math.random() } } : node
        )
      );
    },
    [setNodes]
  );

  const nodeTypes: NodeTypes = useMemo(() => ({
    customInput: (props) => <InputNode {...props} data={{...props.data, onNodeDataChange: onNodeDataChange as any }} />,
    customOutput: OutputNode,
    llm: (props) => <LLMNode {...props} data={{ ...props.data, onNodeDataChange: onNodeDataChange as any}} onCopyApiKeyToAllLLMs={(apiKey) => setNodes(nds => nds.map(n => n.type === 'llm' ? { ...n, data: { ...n.data, apiKey } } : n))} />,
    composio: (props) => <ComposioNode {...props} data={{ ...props.data, onNodeDataChange: onNodeDataChange as any }} onOpenToolsWindow={(apiKey?: string) => { setToolsWindowOpen(true); setCurrentComposioApiKey(apiKey || ''); }} onCopyApiKeyToAllComposioNodes={(apiKey) => setNodes(nds => nds.map(n => n.type === 'composio' ? { ...n, data: { ...n.data, composioApiKey: apiKey } } : n))} />,
    agent: (props) => <AgentNode {...props} data={{ ...props.data, onNodeDataChange: onNodeDataChange as any }} onOpenToolsWindow={(apiKey?: string) => { setToolsWindowOpen(true); setCurrentComposioApiKey(apiKey || ''); }} onCopyApiKeyToAllAgents={(apiKey) => setNodes(nds => nds.map(n => n.type === 'agent' ? { ...n, data: { ...n.data, llmApiKey: apiKey } } : n))} />,
    patternMeta: PatternMetaNode,
  }), [onNodeDataChange, setNodes]);

  const edgeTypes = useMemo(() => ({
    flowing: FlowingEdge,
  }), []);

  useEffect(() => {
    const fetchFlowName = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Get all flows for this user to determine index
      const { data: flows } = await supabase
        .from('flows')
        .select('id, name')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (!flows) return;
      const thisFlow = flows.find(f => f.id === flowId);
      let name = thisFlow?.name || '';
      if (!name) {
        const idx = flows.findIndex(f => f.id === flowId);
        name = `Flow - ${idx + 1}`;
        await supabase.from('flows').update({ name }).eq('id', flowId);
      }
      setFlowName(name);
    };
    fetchFlowName();
  }, [flowId]);

  const handleNameSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEditingName(false);
    const supabase = createClient();
    await supabase.from('flows').update({ name: flowName }).eq('id', flowId);
  };

  const handleNameBlur = async () => {
    setEditingName(false);
    const supabase = createClient();
    await supabase.from('flows').update({ name: flowName }).eq('id', flowId);
  };

  // Helper to push current state to history
  const pushToHistory = useCallback(() => {
    setHistory((h) => [...h, { nodes, edges }]);
  }, [nodes, edges]);

  // Wrap onNodesChange to push to history
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    pushToHistory();
    onNodesChange(changes);
  }, [onNodesChange, pushToHistory]);

  // Wrap onEdgesChange to push to history
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    pushToHistory();
    onEdgesChange(changes);
  }, [onEdgesChange, pushToHistory]);

  // Undo handler
  useEffect(() => {
    const handleUndo = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (history.length > 0) {
          const prev = history[history.length - 1];
          setNodes(prev.nodes);
          setEdges(prev.edges);
          setHistory((h) => h.slice(0, -1));
        }
      }
    };
    window.addEventListener('keydown', handleUndo);
    return () => window.removeEventListener('keydown', handleUndo);
  }, [history, setNodes, setEdges]);

  useEffect(() => {
    const fetchFlowData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: flow, error } = await supabase
        .from('flows')
        .select('graph_json')
        .eq('id', flowId)
        .single();
      if (flow && flow.graph_json) {
        setNodes(flow.graph_json.nodes || []);
        setEdges(flow.graph_json.edges || []);
      }
      setInitialNodesLoaded(true);
      setInitialEdgesLoaded(true);
      setLoading(false);
    };
    fetchFlowData();
  }, [flowId]);

  useEffect(() => {
    if (!initialNodesLoaded || !initialEdgesLoaded) return;
    const updateFlow = async () => {
      const supabase = createClient();
      await supabase.from('flows').update({ graph_json: { nodes, edges } }).eq('id', flowId);
    };
    updateFlow();
  }, [nodes, edges, flowId, initialNodesLoaded, initialEdgesLoaded]);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Helper to generate nodes/edges for each pattern
  function getPatternNodesAndEdges(patternType: string, position: XYPosition, getUniqueNodeId: (type: string) => string, onNodeDataChange: any) {
    // Offset helpers for layout
    const x = position.x;
    const y = position.y;
    const hSpacing = 340; // horizontal spacing between nodes
    const vSpacing = 140; // vertical spacing for branches
    if (patternType === 'augmented-llm') {
      const inputId = getUniqueNodeId('customInput');
      const llmId = getUniqueNodeId('llm');
      const outputId = getUniqueNodeId('customOutput');
      return {
        nodes: [
          { id: inputId, type: 'customInput', position: { x, y }, data: { label: 'Input', query: '', onNodeDataChange, width: 160 } },
          { id: llmId, type: 'llm', position: { x: x + hSpacing, y }, data: { label: 'LLM', systemPrompt: '', apiKey: '', onNodeDataChange, width: 160 } },
          { id: outputId, type: 'customOutput', position: { x: x + hSpacing * 2, y }, data: { label: 'Output', width: 160 } },
        ],
        edges: [
          { id: getUniqueNodeId('e'), source: inputId, target: llmId },
          { id: getUniqueNodeId('e'), source: llmId, target: outputId },
        ]
      };
    }
    if (patternType === 'prompt-chaining') {
      const inputId = getUniqueNodeId('customInput');
      const agent1Id = getUniqueNodeId('agent');
      const agent2Id = getUniqueNodeId('agent');
      const outputId = getUniqueNodeId('customOutput');
      return {
        nodes: [
          { id: inputId, type: 'customInput', position: { x, y }, data: { label: 'Input', query: '', onNodeDataChange, width: 160 } },
          { id: agent1Id, type: 'agent', position: { x: x + hSpacing, y }, data: { label: 'Agent 1', onNodeDataChange, width: 180 } },
          { id: agent2Id, type: 'agent', position: { x: x + hSpacing * 2, y }, data: { label: 'Agent 2', onNodeDataChange, width: 180 } },
          { id: outputId, type: 'customOutput', position: { x: x + hSpacing * 3, y }, data: { label: 'Output', width: 160 } },
        ],
        edges: [
          { id: getUniqueNodeId('e'), source: inputId, target: agent1Id },
          { id: getUniqueNodeId('e'), source: agent1Id, target: agent2Id },
          { id: getUniqueNodeId('e'), source: agent2Id, target: outputId },
        ]
      };
    }
    if (patternType === 'routing') {
      const inputId = getUniqueNodeId('customInput');
      const routerId = getUniqueNodeId('agent');
      const agent1Id = getUniqueNodeId('agent');
      const agent2Id = getUniqueNodeId('agent');
      const outputId = getUniqueNodeId('customOutput');
      return {
        nodes: [
          { id: inputId, type: 'customInput', position: { x, y: y + vSpacing }, data: { label: 'Input', query: '', onNodeDataChange, width: 160 } },
          { id: routerId, type: 'agent', position: { x: x + hSpacing, y: y + vSpacing }, data: { label: 'Router', onNodeDataChange, width: 180 } },
          { id: agent1Id, type: 'agent', position: { x: x + hSpacing * 2, y: y }, data: { label: 'Agent 1', onNodeDataChange, width: 180 } },
          { id: agent2Id, type: 'agent', position: { x: x + hSpacing * 2, y: y + vSpacing * 2 }, data: { label: 'Agent 2', onNodeDataChange, width: 180 } },
          { id: outputId, type: 'customOutput', position: { x: x + hSpacing * 3, y: y + vSpacing }, data: { label: 'Output', width: 160 } },
        ],
        edges: [
          { id: getUniqueNodeId('e'), source: inputId, target: routerId },
          { id: getUniqueNodeId('e'), source: routerId, target: agent1Id },
          { id: getUniqueNodeId('e'), source: routerId, target: agent2Id },
          { id: getUniqueNodeId('e'), source: agent1Id, target: outputId },
          { id: getUniqueNodeId('e'), source: agent2Id, target: outputId },
        ]
      };
    }
    if (patternType === 'parallelisation') {
      const inputId = getUniqueNodeId('customInput');
      const agent1Id = getUniqueNodeId('agent');
      const agent2Id = getUniqueNodeId('agent');
      const aggregatorId = getUniqueNodeId('llm');
      const outputId = getUniqueNodeId('customOutput');
      return {
        nodes: [
          { id: inputId, type: 'customInput', position: { x, y: y + vSpacing }, data: { label: 'Input', query: '', onNodeDataChange, width: 160 } },
          { id: agent1Id, type: 'agent', position: { x: x + hSpacing, y: y }, data: { label: 'Agent 1', onNodeDataChange, width: 180 } },
          { id: agent2Id, type: 'agent', position: { x: x + hSpacing, y: y + vSpacing * 2 }, data: { label: 'Agent 2', onNodeDataChange, width: 180 } },
          { id: aggregatorId, type: 'llm', position: { x: x + hSpacing * 2, y: y + vSpacing }, data: { label: 'Aggregator', onNodeDataChange, width: 160 } },
          { id: outputId, type: 'customOutput', position: { x: x + hSpacing * 3, y: y + vSpacing }, data: { label: 'Output', width: 160 } },
        ],
        edges: [
          { id: getUniqueNodeId('e'), source: inputId, target: agent1Id },
          { id: getUniqueNodeId('e'), source: inputId, target: agent2Id },
          { id: getUniqueNodeId('e'), source: agent1Id, target: aggregatorId },
          { id: getUniqueNodeId('e'), source: agent2Id, target: aggregatorId },
          { id: getUniqueNodeId('e'), source: aggregatorId, target: outputId },
        ]
      };
    }
    if (patternType === 'evaluator-optimiser') {
      const inputId = getUniqueNodeId('customInput');
      const generatorId = getUniqueNodeId('llm');
      const solutionId = getUniqueNodeId('customOutput');
      const evaluatorId = getUniqueNodeId('llm');
      return {
        nodes: [
          { id: inputId, type: 'customInput', position: { x, y }, data: { label: 'Input', query: '', onNodeDataChange, width: 160 } },
          { id: generatorId, type: 'llm', position: { x: x + hSpacing, y }, data: { label: 'Generator', onNodeDataChange, width: 160 } },
          { id: solutionId, type: 'customOutput', position: { x: x + hSpacing * 2, y }, data: { label: 'Solution', width: 160 } },
          { id: evaluatorId, type: 'llm', position: { x: x + hSpacing, y: y + vSpacing }, data: { label: 'Evaluator', onNodeDataChange, width: 160 } },
        ],
        edges: [
          { id: getUniqueNodeId('e'), source: inputId, target: generatorId },
          { id: getUniqueNodeId('e'), source: generatorId, target: solutionId },
          { id: getUniqueNodeId('e'), source: generatorId, target: evaluatorId },
          { id: getUniqueNodeId('e'), source: evaluatorId, target: generatorId },
        ]
      };
    }
    return { nodes: [], edges: [] };
  }

  const expandPatternMetaNode = (metaNodeId: string, patternType: string, position: XYPosition) => {
    const { nodes: patternNodes, edges: patternEdges } = getPatternNodesAndEdges(patternType, position, getUniqueNodeId, onNodeDataChange);
    // Compute nodeIds and edgeIds for collapse
    const nodeIds = patternNodes.map(n => n.id);
    const edgeIds = patternEdges.map(e => e.id);
    // Compute centroid for collapse
    const centroid = patternNodes.reduce((acc, n) => ({ x: acc.x + n.position.x, y: acc.y + n.position.y }), { x: 0, y: 0 });
    centroid.x /= patternNodes.length;
    centroid.y /= patternNodes.length;
    // Get label/description
    let label = '';
    let description = '';
    if (patternType === 'augmented-llm') {
      label = 'Augmented LLM';
      description = 'Input → LLM+Tools → Output';
    } else if (patternType === 'prompt-chaining') {
      label = 'Prompt Chaining';
      description = 'Input → Agent 1 → Agent 2 → Output';
    } else if (patternType === 'routing') {
      label = 'Routing';
      description = 'Input → Router → Agent 1/2 → Output';
    } else if (patternType === 'parallelisation') {
      label = 'Parallelisation';
      description = 'Input → Agents (parallel) → Aggregator → Output';
    } else if (patternType === 'evaluator-optimiser') {
      label = 'Evaluator-Optimiser';
      description = 'Input → Generator → Evaluator (loop) → Output';
    }
    // Pass onCollapse to each node's data
    const nodesWithCollapse = patternNodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        onCollapse: () => collapsePattern(patternType, nodeIds, edgeIds, centroid, label, description)
      }
    }));
    setNodes(nds => nds.filter(n => n.id !== metaNodeId).concat(nodesWithCollapse));
    setEdges(eds => eds.concat(patternEdges));
  };

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      if (!rfInstance) return;

      // Pattern drop logic
      const patternType = event.dataTransfer.getData('application/pattern');
      if (patternType) {
        const position: XYPosition = rfInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        if (dropAsMetaNode) {
          // Insert a PatternMetaNode
          let label = '';
          let description = '';
          if (patternType === 'augmented-llm') {
            label = 'Augmented LLM';
            description = 'Input → LLM+Tools → Output';
          } else if (patternType === 'prompt-chaining') {
            label = 'Prompt Chaining';
            description = 'Input → Agent 1 → Agent 2 → Output';
          } else if (patternType === 'routing') {
            label = 'Routing';
            description = 'Input → Router → Agent 1/2 → Output';
          } else if (patternType === 'parallelisation') {
            label = 'Parallelisation';
            description = 'Input → Agents (parallel) → Aggregator → Output';
          } else if (patternType === 'evaluator-optimiser') {
            label = 'Evaluator-Optimiser';
            description = 'Input → Generator → Evaluator (loop) → Output';
          }
          setNodes(nds => nds.concat({
            id: getUniqueNodeId('patternMeta'),
            type: 'patternMeta',
            position,
            data: { patternType, label, description, onExpand: (id: string) => {
              expandPatternMetaNode(id, patternType, position);
            } },
          }));
          return;
        }
        // Expanded pattern logic
        const { nodes: patternNodes, edges: patternEdges } = getPatternNodesAndEdges(patternType, position, getUniqueNodeId, onNodeDataChange);
        setNodes(nds => nds.concat(patternNodes));
        setEdges(eds => eds.concat(patternEdges));
        return;
      }

      // Node drop logic
      const type = event.dataTransfer.getData('application/reactflow');
      const initialNodeDataJSON = event.dataTransfer.getData('application/nodeInitialData');
      const initialNodeData = JSON.parse(initialNodeDataJSON || '{}');
      if (typeof type === 'undefined' || !type) return;
      const position: XYPosition = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      let nodeData: any = { ...initialNodeData };
      if (type === 'customInput' || type === 'llm' || type === 'composio') {
        nodeData.onNodeDataChange = onNodeDataChange;
      }
      const newNode: Node = {
        id: getUniqueNodeId(type),
        type,
        position,
        data: nodeData,
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [rfInstance, setNodes, onNodeDataChange, dropAsMetaNode]
  );
  
  const onDragStart = (event: DragEvent, nodeType: string, nodeLabel: string, initialData: object) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/nodeInitialData', JSON.stringify(initialData));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleSerializeGraph = (forSave = false) => {
    // Ensure callbacks are removed before serialization
    const nodesToSerialize = nodes.map(node => ({
      ...node,
      data: { ...node.data, onNodeDataChange: undefined }
    }));
    const graph = {
      nodes: nodesToSerialize,
      edges,
    };
    const json = JSON.stringify(graph, null, 2);
    if (!forSave) {
      setSerializedGraph(json);
      console.log("Serialized Graph for Backend:", json); // Log the structure being sent
    }
    return graph;
  };

  // --- Share Workflow Logic ---
  const handleShareWorkflow = () => {
    const graphToSave = handleSerializeGraph(true); // Serialize without updating the state
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(graphToSave, null, 2)
    )}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "workflow.json";
    link.click();
  };

  // --- Upload Workflow Logic ---
  const handleUploadClick = () => {
    fileInputRef.current?.click(); // Trigger the hidden file input
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("Failed to read file content.");

        const parsedGraph = JSON.parse(text);

        // Basic validation
        if (!parsedGraph || !Array.isArray(parsedGraph.nodes) || !Array.isArray(parsedGraph.edges)) {
          throw new Error("Invalid workflow file format. Missing 'nodes' or 'edges' array.");
        }

        // TODO: Add more robust validation if needed (e.g., check node types, data structure)

        // Restore the onNodeDataChange callback
        const restoredNodes = parsedGraph.nodes.map((node: Node) => ({
          ...node,
          data: { ...node.data, onNodeDataChange: onNodeDataChange },
        }));

        pushToHistory(); // Save current state before overwriting
        setNodes(restoredNodes);
        setEdges(parsedGraph.edges);

        // Clear the input value so the same file can be uploaded again if needed
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        alert("Workflow loaded successfully!");

      } catch (error: any) {
        console.error("Error loading workflow:", error);
        alert(`Failed to load workflow: ${error.message}`);
        // Clear the input value on error too
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };
    reader.onerror = (e) => {
      console.error("FileReader error:", e);
      alert("Error reading file.");
       if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
    };
    reader.readAsText(file);
  };

  // --- Play Button Logic ---
  const handleRunAgentFromBuilder = async () => {
    const graph = handleSerializeGraph();
    if (!graph || graph.nodes.length === 0) {
      alert("Graph is empty or invalid.");
      return;
    }
    const inputNode = graph.nodes.find(node => node.type === 'customInput') as Node<InputNodeData> | undefined;
    if (!inputNode?.data?.query) {
      alert("Please provide a query in an Input Node.");
      return;
    }
    setIsAgentRunning(true);
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphJson: graph }),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || `API request failed: ${response.status}`);
      }
      // Set result in output node
      setNodes(nds => nds.map(node =>
        node.type === 'customOutput'
          ? { ...node, data: { ...node.data, agentOutput: responseData.response || '' } }
          : node
      ));
    } catch (error: any) {
      setNodes(nds => nds.map(node =>
        node.type === 'customOutput'
          ? { ...node, data: { ...node.data, agentOutput: error.message } }
          : node
      ));
    } finally {
      setIsAgentRunning(false);
    }
  };

  // Advanced: ReactFlow onNodeDrag/onNodeDragStop handlers
  const onNodeDrag: NodeDragHandler = useCallback((event, node) => {
    // Use mouse position for dustbin overlap
    if (event && 'clientX' in event && 'clientY' in event) {
      const mouseX = event.clientX;
      const mouseY = event.clientY;
      // Use mouse position for dustbin overlap
      let shouldDelete = false;
      if (event && 'clientX' in event && 'clientY' in event) {
        const dustbinRect = { left: 0, right: 0, top: 0, bottom: 0 };
        if (
          mouseX > dustbinRect.left &&
          mouseX < dustbinRect.right &&
          mouseY > dustbinRect.top &&
          mouseY < dustbinRect.bottom
        ) {
          shouldDelete = true;
        }
      }
      if (shouldDelete) {
        setNodes((nds) => nds.filter((n) => n.id !== node.id));
      }
    }
  }, []);

  const onNodeDragStop: NodeDragHandler = useCallback((event, node) => {
    // Use mouse position for dustbin overlap
    let shouldDelete = false;
    if (event && 'clientX' in event && 'clientY' in event) {
      const mouseX = event.clientX;
      const mouseY = event.clientY;
      const dustbinRect = { left: 0, right: 0, top: 0, bottom: 0 };
      if (
        mouseX > dustbinRect.left &&
        mouseX < dustbinRect.right &&
        mouseY > dustbinRect.top &&
        mouseY < dustbinRect.bottom
      ) {
        shouldDelete = true;
      }
    }
    if (shouldDelete) {
      setNodes((nds) => nds.filter((n) => n.id !== node.id));
    }
  }, [setNodes]);

  // Track selected nodes
  const onSelectionChange = useCallback(({ nodes: selected }: { nodes: Node[] }) => {
    setSelectedNodes(selected);
  }, []);

  // Copy selected nodes to clipboard
  useEffect(() => {
    const handleCopy = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedNodes.length > 0) {
          setClipboardNodes(selectedNodes.map(n => ({ ...n })));
        }
      }
    };
    window.addEventListener('keydown', handleCopy);
    return () => window.removeEventListener('keydown', handleCopy);
  }, [selectedNodes]);

  // Paste nodes from clipboard
  useEffect(() => {
    const handlePaste = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboardNodes && clipboardNodes.length > 0) {
          const offset = 40;
          const newNodes = clipboardNodes.map((node) => {
            const newId = getUniqueNodeId(node.type || 'node');
            return {
              ...node,
              id: newId,
              position: {
                x: (node.position?.x || 0) + offset,
                y: (node.position?.y || 0) + offset,
              },
              selected: false,
              data: { ...node.data },
            };
          });
          setNodes((nds) => nds.concat(newNodes));
        }
      }
    };
    window.addEventListener('keydown', handlePaste);
    return () => window.removeEventListener('keydown', handlePaste);
  }, [clipboardNodes, setNodes]);

  const onEdgeClick = useCallback((event: any, edge: any) => {
    event.stopPropagation();
    setSelectedEdgeId(prevId => prevId === edge.id ? null : edge.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedEdgeId(null);
  }, []);

  // Add collapsePattern helper
  function collapsePattern(patternType: string, nodeIds: string[], edgeIds: string[], centroid: XYPosition, label: string, description: string) {
    setNodes(nds => nds.filter(n => !nodeIds.includes(n.id)).concat({
      id: getUniqueNodeId('patternMeta'),
      type: 'patternMeta',
      position: centroid,
      data: { patternType, label, description, onExpand: (id: string) => {
        expandPatternMetaNode(id, patternType, centroid);
      }, onCollapse: undefined },
    }));
    setEdges(eds => eds.filter(e => !edgeIds.includes(e.id)));
  }

  // Highlight selected nodes and add running animation
  const highlightedNodes = nodes.map(node => {
    if (isAgentRunning) {
      return {
        ...node,
        style: {
          ...(node.style || {}),
          animation: 'glowingNode 4s linear infinite',
          boxShadow: '0 0 10px rgba(255, 245, 245, 0.3)',
          border: '1px solid rgba(255, 245, 245, 0.5)',
          transition: 'all 0.3s ease-in-out',
        }
      };
    }
    return node.selected
      ? {
          ...node,
          style: {
            ...(node.style || {}),
            border: '2px solid #b3b3b3',
            borderRadius: '0.5rem',
            boxShadow: '0 0 0 4px rgba(179,179,179,0.18), 0 0 12px 2px #b3b3b3',
            zIndex: 10,
            transition: 'box-shadow 0.2s, border-color 0.2s',
          }
        }
      : node;
  });

  // Keyboard shortcuts for selected nodes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput = active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT' ||
        (active as HTMLElement).isContentEditable
      );
      // Delete selected nodes
      if (!isInput && (e.key === 'Backspace' || e.key === 'Delete') && selectedNodes.length > 0) {
        setNodes(nds => nds.filter(n => !selectedNodes.some(sel => sel.id === n.id)));
        setEdges(eds => eds.filter(e => !selectedNodes.some(sel => sel.id === e.source || sel.id === e.target)));
        setSelectedNodes([]);
      }
      // Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedNodes.length > 0) {
        setClipboardNodes(selectedNodes.map(n => ({ ...n })));
      }
      // Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboardNodes && clipboardNodes.length > 0) {
        const offset = 40;
        const newNodes = clipboardNodes.map((node) => {
          const newId = getUniqueNodeId(node.type || 'node');
          return {
            ...node,
            id: newId,
            position: {
              x: (node.position?.x || 0) + offset,
              y: (node.position?.y || 0) + offset,
            },
            selected: false,
            data: { ...node.data },
          };
        });
        setNodes((nds) => nds.concat(newNodes));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodes, clipboardNodes]);

  // Handler for ToolsWindow to add actions to the selected node
  const handleAddActionsToAgent = (actions: any[]) => {
    if (!selectedNodes || selectedNodes.length === 0) return;
    const node = selectedNodes.find((n: Node) => n.type === 'agent' || n.type === 'composio');
    if (!node) return;
    // Compose action keys as comma-separated string
    const actionKeys = actions.map(a => a.name).join(',');
    setNodes(nds => nds.map((n: Node) => {
      if (n.id === node.id) {
        return {
          ...n,
          data: {
            ...n.data,
            allowedTools: actionKeys,
            toolActions: actionKeys,
          }
        };
      }
      return n;
    }));
    setToolsWindowOpen(false);
  };

  // Helper to get composioApiKey from selected node
  const getSelectedComposioApiKey = () => {
    if (!selectedNodes || selectedNodes.length === 0) return '';
    const node = selectedNodes.find((n: Node) => n.type === 'agent' || n.type === 'composio');
    if (!node) return '';
    if (node.type === 'agent') return node.data.composioApiKey || '';
    if (node.type === 'composio') return node.data.composioApiKey || '';
    return '';
  };

  // Check if tutorial should be shown on mount
  useEffect(() => {
    const shouldShowTutorial = localStorage.getItem('showBuilderTutorial');
    if (shouldShowTutorial === 'true') {
      setTimeout(() => {
        setRunJoyride(true);
        localStorage.removeItem('showBuilderTutorial');
      }, 500);
    }
  }, []);

  // Add tutorial completion handler
  const handleTutorialComplete = () => {
    setRunJoyride(false);
  };

  const joyrideSteps = [
    {
      target: '.overflow-y-auto.transition-all',
      content: 'This is the Node Library. Drag nodes onto the canvas to build your flow.',
      placement: 'right' as const,
      disableBeacon: true,
    },
    {
      target: '[data-tutorial="canvas"]',
      content: 'This is your canvas. Connect nodes to define your workflow.',
      placement: 'center' as const,
      disableBeacon: true,
    },
    {
      target: '[data-tutorial="run-agent"]',
      content: 'Click here to run your agent once your flow is ready!',
      placement: 'top' as const,
      disableBeacon: true,
    },
  ];

  if (backLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ 
      background: '#000000',
      color: '#fff5f5',
      backdropFilter: 'blur(10px)',
    }}>
      <Joyride
        steps={joyrideSteps}
        run={runJoyride}
        continuous
        showSkipButton
        showProgress
        styles={{
          options: {
            zIndex: 10000,
            primaryColor: '#111',
            textColor: '#222',
            backgroundColor: '#fff',
          },
        }}
        callback={data => {
          if (data.status === 'finished' || data.status === 'skipped') {
            setRunJoyride(false);
          }
        }}
      />

      {/* Top Bar */}
      <header className="h-16 flex items-center justify-between px-6 shrink-0" style={{ 
        background: 'rgba(0, 0, 0, 0.7)',
        borderBottom: '1px solid rgba(255, 245, 245, 0.2)',
        backdropFilter: 'blur(10px)',
      }}>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              const supabase = createClient();
              await supabase.from('flows').update({ graph_json: { nodes, edges } }).eq('id', flowId);
              router.push('/dashboard');
            }}
            className="p-1.5 rounded-md transition-all duration-200 hover:bg-[#fff5f5]/20 hover:scale-105"
            style={{
              background: 'rgba(255, 245, 245, 0.1)',
              color: '#fff5f5',
              backdropFilter: 'blur(5px)',
            }}
            title="Back to Dashboard"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          {editingName ? (
            <form onSubmit={handleNameSubmit} className="ml-2">
              <input
                autoFocus
                value={flowName}
                onChange={e => setFlowName(e.target.value)}
                onBlur={handleNameBlur}
                className="text-xl font-semibold bg-transparent border-b border-primary text-[#fff5f5] focus:outline-none px-1 w-48 focus:text-[#fff5f5] hover:text-[#fff5f5]"
              />
            </form>
          ) : (
            <span
              className="text-xl font-semibold text-[#fff5f5] ml-2 cursor-pointer hover:text-[#fff5f5]"
              onDoubleClick={() => setEditingName(true)}
              title="Double click to rename"
            >
              {flowName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Share Button */}
          <button 
            onClick={handleShareWorkflow}
            className="px-3 py-1.5 text-sm rounded-md transition-all duration-200 flex items-center gap-1.5 hover:bg-[#fff5f5]/20 hover:scale-105"
            style={{
              background: 'rgba(255, 245, 245, 0.1)',
              color: '#fff5f5',
              backdropFilter: 'blur(5px)',
            }}
            title="Download current workflow as JSON"
          >
            <Share2 size={16} /> Share
          </button>
          {/* Upload Button - Triggers hidden input */}
          <button 
            onClick={handleUploadClick}
            className="px-3 py-1.5 text-sm rounded-md transition-all duration-200 flex items-center gap-1.5 hover:bg-[#fff5f5]/20 hover:scale-105"
            style={{
              background: 'rgba(255, 245, 245, 0.1)',
              color: '#fff5f5',
              backdropFilter: 'blur(5px)',
            }}
            title="Load workflow from JSON file"
          >
            <Upload size={16} /> Upload
          </button>
          {/* Hidden file input */}
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            style={{ display: 'none' }} 
          />
          <button className="px-3 py-1.5 text-sm rounded-md transition-all duration-200 hover:bg-[#fff5f5]/20 hover:scale-105" style={{
            background: 'rgba(255, 245, 245, 0.1)',
            color: '#fff5f5',
            backdropFilter: 'blur(5px)',
          }}>Add Interface</button>
        </div>
      </header>

      {/* Move sidebar toggle below navbar */}
      <div className="flex items-center px-6 py-2" style={{background: 'rgba(0,0,0,0.7)', borderBottom: '1px solid rgba(255,245,245,0.1)', backdropFilter: 'blur(10px)'}}>
        <button 
          onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
          className="p-1.5 rounded-md transition-all duration-200 hover:bg-[#fff5f5]/20 hover:scale-105"
          style={{
            background: 'rgba(255, 245, 245, 0.1)',
            color: '#fff5f5',
            backdropFilter: 'blur(5px)',
          }}
          title={isLeftSidebarOpen ? "Close Left Sidebar" : "Open Left Sidebar"}
        >
          {isLeftSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>
      </div>

      <div className="flex flex-grow min-h-0">
        {/* Left Sidebar */}
        <aside 
          data-tutorial="node-library"
          className={`flex flex-col shrink-0 overflow-y-auto transition-all duration-300 ease-in-out 
                     ${isLeftSidebarOpen ? 'w-72 p-4' : 'w-0 p-0 overflow-hidden'}`}
          style={{ 
            background: 'rgba(0, 0, 0, 0.7)',
            borderRight: '1px solid rgba(255, 245, 245, 0.2)',
            backdropFilter: 'blur(10px)',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255, 245, 245, 0.3) transparent'
          }}
        >
          {isLeftSidebarOpen && (
            <>
              <div className="sticky top-0 z-20 pb-2 mb-3 flex flex-col gap-2 bg-[rgba(0,0,0,0.7)]" style={{ borderBottom: '1px solid rgba(255, 245, 245, 0.2)' }}>
                <span className="text-xl font-bold text-[#fff5f5] tracking-tight">Node Library</span>
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search nodes or patterns..."
                  className="mt-1 bg-black/40 border border-[#fff5f5]/20 text-[#fff5f5] placeholder:text-[#fff5f5]/40"
                />
              </div>
              <div className="flex flex-col gap-4 flex-grow overflow-y-auto" style={{
                  paddingBottom: '1rem', 
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(255, 245, 245, 0.3) transparent',
                  maxHeight: 'calc(100vh - 120px)'
              }}>
                {filteredSidebarItems.map(item => (
                  <div
                    key={item.key}
                    data-tutorial={
                      item.dragType === 'node' && 
                      ((item.dragData as any).nodeType === 'customInput' ? 'input-node' : 
                       (item.dragData as any).nodeType === 'llm' ? 'llm-node' : 
                       undefined)
                    }
                    onDragStart={event => {
                      if (item.dragType === 'node') {
                        const nodeData = item.dragData as { nodeType: string; nodeLabel: string; initialData: any };
                        onDragStart(event, nodeData.nodeType, nodeData.nodeLabel, nodeData.initialData);
                      } else if (item.dragType === 'pattern') {
                        const patternData = item.dragData as { pattern: string };
                        event.dataTransfer.setData('application/pattern', patternData.pattern);
                        event.dataTransfer.effectAllowed = 'move';
                      }
                    }}
                    draggable
                    className="group relative p-4 rounded-xl cursor-grab active:scale-[0.97] transition-all duration-200"
                    style={{
                      background: 'rgba(255, 245, 245, 0.1)',
                      backdropFilter: 'blur(5px)',
                      border: '1px solid rgba(255, 245, 245, 0.2)',
                    }}
                  >
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-1" style={{
                        background: 'rgba(255, 245, 245, 0.15)',
                        backdropFilter: 'blur(5px)',
                      }}>
                        {item.icon}
                      </div>
                      <span className="text-sm font-medium text-[#fff5f5]">{item.label}</span>
                      <div className="text-xs text-[#fff5f5]/70 mt-1">{item.description}</div>
                    </div>
                    <div 
                      className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        background: 'rgba(255, 245, 245, 0.05)',
                        border: '1px solid rgba(255, 245, 245, 0.3)',
                        backdropFilter: 'blur(5px)',
                      }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* React Flow Canvas */}
        <main 
          data-tutorial="canvas"
          className="flex-grow h-full relative" 
          onDrop={onDrop} 
          onDragOver={onDragOver}
        >
          <Squares className="absolute inset-0 z-0" />
          <ReactFlow
            nodes={highlightedNodes}
            edges={edges.map(edge => ({
              ...edge,
              type: isAgentRunning ? 'flowing' : 'default',
              style: edge.id === selectedEdgeId
                ? {
                    ...(edge.style || {}),
                    stroke: '#fff5f5',
                    strokeWidth: 3,
                    filter: 'drop-shadow(0 0 8px rgba(255, 245, 245, 0.5))'
                  }
                : edge.style,
              markerEnd: edge.id === selectedEdgeId
                ? {
                    type: MarkerType.ArrowClosed,
                    color: '#fff5f5',
                    width: 15,
                    height: 15,
                  }
                : edge.markerEnd
            }))}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            defaultViewport={{ x: 0, y: 0, zoom: 0.4 }}
            panOnScroll={true}
            selectionOnDrag={true}
            panOnDrag={[1, 2]}
            selectionMode={SelectionMode.Partial}
            snapToGrid={true}
            snapGrid={[20, 20]}
            style={{ background: 'transparent' }}
            className="relative z-10"
            defaultEdgeOptions={{
              style: { stroke: 'rgba(255, 245, 245, 0.6)', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(255, 245, 245, 0.6)', width: 15, height: 15 },
              type: 'default',
            }}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onSelectionChange={onSelectionChange}
          >
            <Controls />
            <style jsx global>{`
              @keyframes glowingNode {
                0% {
                  box-shadow: 0 0 15px #2E67F8, 0 0 25px rgba(46, 103, 248, 0.3);
                  border-color: #2E67F8;
                }
                33% {
                  box-shadow: 0 0 15px #30BF78, 0 0 25px rgba(48, 191, 120, 0.3);
                  border-color: #30BF78;
                }
                66% {
                  box-shadow: 0 0 15px #FF3B3B, 0 0 25px rgba(255, 59, 59, 0.3);
                  border-color: #FF3B3B;
                }
                100% {
                  box-shadow: 0 0 15px #2E67F8, 0 0 25px rgba(46, 103, 248, 0.3);
                  border-color: #2E67F8;
                }
              }
            `}</style>
          </ReactFlow>
          {toolsWindowOpen && (
            <ToolsWindow
              onClose={() => setToolsWindowOpen(false)}
              onSelectTool={handleAddActionsToAgent}
              onConnect={() => {
                // Potentially refresh or refetch tool connections here
              }}
              composioApiKey={currentComposioApiKey || getSelectedComposioApiKey()}
            />
          )}
          {/* Play Button at bottom center */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-4">
            <button
              data-tutorial="run-agent"
              onClick={handleRunAgentFromBuilder}
              disabled={isAgentRunning}
              className="px-6 py-3 text-base font-medium rounded-lg shadow-md transition-all duration-200 flex items-center justify-center gap-2 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed border border-slate-300 hover:shadow-lg"
              title="Run Agent from Flow"
            >
              {isAgentRunning ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Running...</span>
                </>
              ) : (
                <span>Run Agent</span>
              )}
            </button>
            <AgentBuilder onSubmit={async (data, close) => {
              // Call backend to generate graph
              const res = await fetch('/api/chat-to-agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  useCase: data.description,
                  llmApiKey: data.llmApiKey,
                  composioApiKey: data.composioApiKey,
                })
              });
              if (!res.ok) {
                let errorMsg = 'Failed to generate agent flow';
                try {
                  const err = await res.json();
                  if (err.error && err.details) {
                    errorMsg = `${err.error}: ${err.details}`;
                  } else if (err.error) {
                    errorMsg = err.error;
                  }
                } catch {}
                alert(errorMsg);
                return;
              }
              const result = await res.json();
              if (result.nodes && result.edges) {
                setNodes(result.nodes);
                setEdges(result.edges);
                close();
              } else {
                alert('Agent builder did not return a valid graph');
              }
            }} />
          </div>
        </main>
      </div>

      {/* Onboarding Tutorial */}
      {showTutorial && <OnboardingTutorial onComplete={() => setShowTutorial(false)} />}
    </div>
  );
};

const initialEdges: Edge[] = [];