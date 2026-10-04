import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ThinkingDot from '../components/chat/ThinkingDot';
import ThoughtProcessDrawer from '../components/chat/ThoughtProcessDrawer';
import ResearchProgressIndicator from '../components/chat/ResearchProgressIndicator';
import ToolExecutionCard from '../components/chat/ToolExecutionCard';
import ChatMessageBubble from '../components/chat/ChatMessageBubble';

describe('AI-Dost 6-Animation & Activity Indicators Suite', () => {
  // 1. AI Thinking Animation (AI के सोचने का संकेत देना)
  describe('1. AI Thinking Animation', () => {
    it('renders the glowing orbital thinking animation and timer', () => {
      render(<ThinkingDot label="Thinking…" elapsed={3} />);
      const container = screen.getByTestId('ai-thinking-animation');
      expect(container).toBeInTheDocument();
      expect(screen.getByText(/3s elapsed/i)).toBeInTheDocument();
      expect(screen.getByText('AI-Dost Engine')).toBeInTheDocument();
    });
  });

  // 2. AI Activity Indicator (AI अभी क्या कर रहा है, यह दिखाना)
  describe('2. AI Activity Indicator', () => {
    it('displays dynamic activity state based on elapsed phase', () => {
      const { rerender } = render(<ThinkingDot label="Thinking…" elapsed={1} />);
      expect(screen.getByText('Analyzing prompt & context…')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();

      rerender(<ThinkingDot label="Thinking…" elapsed={3} />);
      expect(screen.getByText('Formulating reasoning pathway…')).toBeInTheDocument();

      rerender(<ThinkingDot label="Thinking…" elapsed={5} />);
      expect(screen.getByText('Synthesizing knowledge & facts…')).toBeInTheDocument();

      rerender(<ThinkingDot label="Thinking…" elapsed={8} />);
      expect(screen.getByText('Assembling comprehensive response…')).toBeInTheDocument();
    });

    it('displays explicit activity label when provided', () => {
      render(<ThinkingDot label="Reading webpage…" elapsed={2} />);
      expect(screen.getByText('Reading webpage…')).toBeInTheDocument();
    });
  });

  // 3. Research Progress Indicator (AI की रिसर्च की प्रगति दिखाना)
  describe('3. Research Progress Indicator', () => {
    it('renders active research progress with 3-step pipeline', () => {
      const sources = [
        { title: 'Bihar Economy', url: 'https://bihar.gov.in', citationId: 1 },
        { title: 'Patna Development', url: 'https://patna.nic.in', citationId: 2 },
      ];
      render(
        <ResearchProgressIndicator
          query="Bihar GDP 2026"
          sources={sources}
          isSearching={false}
          status="2 verified sources consulted"
        />
      );

      expect(screen.getByTestId('research-progress-indicator')).toBeInTheDocument();
      expect(screen.getByText('Verified Web Research')).toBeInTheDocument();
      expect(screen.getByText(/Bihar GDP 2026/)).toBeInTheDocument();
      expect(screen.getByText('1. Query Dispatched')).toBeInTheDocument();
      expect(screen.getByText('2. Sources Found (2)')).toBeInTheDocument();
      expect(screen.getByText('3. Synthesizing')).toBeInTheDocument();
      expect(screen.getByText('Complete')).toBeInTheDocument();

      // Toggle drawer
      const toggleBtn = screen.getByTitle('Toggle source list');
      fireEvent.click(toggleBtn);
      expect(screen.getByText('Bihar Economy')).toBeInTheDocument();
      expect(screen.getByText('Patna Development')).toBeInTheDocument();
    });

    it('shows researching status when active search is underway', () => {
      render(
        <ResearchProgressIndicator
          query="Latest ISRO launch"
          sources={[]}
          isSearching={true}
          status="Scanning live web..."
        />
      );
      expect(screen.getByText('Deep Web Research')).toBeInTheDocument();
      expect(screen.getByText('Researching')).toBeInTheDocument();
      expect(screen.getByText('Scanning live web...')).toBeInTheDocument();
    });
  });

  // 4. Tool Calling Animation (AI जब Search, Python या अन्य टूल इस्तेमाल करे, तब उसकी गतिविधि दिखाना)
  describe('4. Tool Calling Animation', () => {
    it('renders active tool execution with animated status and collapsible details', () => {
      render(
        <ToolExecutionCard
          tool="python_runner"
          target="compute_metrics.py"
          status="running"
          duration="120ms"
          output="Calculation in progress..."
        />
      );

      const card = screen.getByTestId('tool-calling-animation');
      expect(card).toBeInTheDocument();
      expect(screen.getByText('python_runner')).toBeInTheDocument();
      expect(screen.getByText('compute_metrics.py')).toBeInTheDocument();
      expect(screen.getByText('running')).toBeInTheDocument();

      // Expand output
      const btn = screen.getByRole('button');
      fireEvent.click(btn);
      expect(screen.getByText(/Calculation in progress/)).toBeInTheDocument();
    });
  });

  // 5. Streaming Status Indicator (AI के जवाब तैयार होने की प्रक्रिया दिखाना)
  describe('5. Streaming Status Indicator', () => {
    it('renders streaming cursor and live status pill during response streaming', () => {
      const msg = {
        id: 101,
        role: 'assistant',
        content: 'Namaste! Main aapki sahayata kar raha hoon.',
        isStreaming: true,
      };

      render(<ChatMessageBubble msg={msg} />);
      expect(screen.getByTestId('streaming-cursor')).toBeInTheDocument();
      expect(screen.getByTestId('streaming-status-indicator')).toBeInTheDocument();
      expect(screen.getByText('Streaming response…')).toBeInTheDocument();
      expect(screen.getByText('Live token delivery')).toBeInTheDocument();
    });
  });

  // 6. Chain of Thought Visualization (AI की आंतरिक reasoning को प्रदर्शित करने का प्रयास)
  describe('6. Chain of Thought Visualization', () => {
    it('renders collapsible chain of thought drawer with step-by-step reasoning trace', () => {
      const thoughtText = 'Step 1: Identify question requirements\nStep 2: Cross-check historical facts\nStep 3: Validate conclusion';
      render(
        <ThoughtProcessDrawer
          thought={thoughtText}
          isThinking={false}
          elapsed={2.4}
        />
      );

      const drawer = screen.getByTestId('chain-of-thought-drawer');
      expect(drawer).toBeInTheDocument();
      expect(screen.getByText('Chain of Thought')).toBeInTheDocument();
      expect(screen.getByText(/Thought for 2.4s/)).toBeInTheDocument();

      // Click to expand reasoning trace
      const toggleBtn = screen.getByLabelText('Toggle chain of thought visualization');
      fireEvent.click(toggleBtn);
      expect(screen.getByText(/Step 1: Identify question requirements/)).toBeInTheDocument();
      expect(screen.getByText(/Step-by-step reasoning trace/i)).toBeInTheDocument();
    });

    it('displays live reasoning state while active reasoning is streaming', () => {
      render(
        <ThoughtProcessDrawer
          thought="Currently exploring multiple pathways..."
          isThinking={true}
          elapsed={1.5}
        />
      );

      expect(screen.getByText(/Reasoning live… 1.5s/)).toBeInTheDocument();
      // Auto-expanded while thinking
      expect(screen.getByText(/Currently exploring multiple pathways/)).toBeInTheDocument();
    });
  });
});
