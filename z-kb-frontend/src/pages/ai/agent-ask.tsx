import Icon from '@/components/icon';
import {
  getAiRuntimeStatus,
  listAiAgents,
  listAiSkills,
  listAiTools,
  type AiAgentRecord,
  type AiRuntimeStatus,
  type AiSkillRecord,
  type AiToolRecord,
} from '@/services/ai';
import { AI_QA_AGENT_CODE, AgentRunDrawer } from '@/pages/ai/agent-run-drawer';
import { toast } from '@/utils/toast';
import { useState } from 'react';

interface AgentSession {
  agent: AiAgentRecord;
  skills: AiSkillRecord[];
  tools: AiToolRecord[];
  runtime?: AiRuntimeStatus;
}

/**
 * 优先用运行时下发的编码：远端运行时的智能体有自己的命名，平台逻辑编码可能不在注册表里；
 * 两者都查不到时再退回逻辑编码，保持本地替身与旧环境的行为。
 */
function resolveAgent(
  agents: AiAgentRecord[],
  logicalCode: string,
  runtimeCode?: string,
): AiAgentRecord | undefined {
  const candidates = [runtimeCode, logicalCode].filter(
    (code, index, list): code is string => !!code && list.indexOf(code) === index,
  );
  for (const code of candidates) {
    const found = agents.find((item) => item.code === code);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/**
 * 知识库页面里的统一 AI 入口：点击后加载已发布的问答智能体，并带上当前库与可选问题。
 *
 * <p>智能体、技能与工具都从 AI 注册表读取，不在页面里写死回答逻辑。
 */
export function AgentAskButton({
  kbId,
  question,
  label = '问 AI',
  agentCode = AI_QA_AGENT_CODE,
  className = 'btn',
  disabled,
}: {
  kbId?: string;
  question?: string;
  label?: string;
  agentCode?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<AgentSession | null>(null);

  const open = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    const [agents, skills, tools, runtime] = await Promise.all([
      listAiAgents(),
      listAiSkills(),
      listAiTools(),
      getAiRuntimeStatus(),
    ]);
    setLoading(false);
    if (agents === undefined) {
      toast(
        'AI 运行时不可用',
        '智能体注册表读取失败，请确认后端已启动。',
        'error',
      );
      return;
    }
    const agent = resolveAgent(agents, agentCode, runtime?.qaAgentCode);
    if (!agent) {
      toast(
        '未找到问答智能体',
        `AI 注册表里没有 ${runtime?.qaAgentCode || agentCode}，请先在基础设施创建并发布。`,
        'info',
      );
      return;
    }
    if (agent.status === 'paused') {
      toast('智能体已暂停', '恢复后才能发起问答。', 'info');
      return;
    }
    setSession({
      agent,
      skills: skills || [],
      tools: tools || [],
      runtime,
    });
  };

  return (
    <>
      <button
        className={className}
        type="button"
        disabled={disabled || loading}
        title="在当前知识库范围内向 AI 提问"
        onClick={() => void open()}
      >
        {loading ? <span className="spinner" /> : <Icon name="sparkles" size={14} />}
        {label}
      </button>
      {session ? (
        <AgentRunDrawer
          agent={session.agent}
          skills={session.skills}
          tools={session.tools}
          runtime={session.runtime}
          initialKbId={kbId}
          initialQuestion={question}
          title="AI 问答"
          onClose={() => setSession(null)}
        />
      ) : null}
    </>
  );
}
