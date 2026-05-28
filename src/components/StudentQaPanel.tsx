"use client";

import { type FormEvent, useState } from "react";

type MatchedRule = {
  rule_id: string;
  category: string;
  risk_level: string;
  risk_tags: string[];
  source: string;
};

const SUGGESTIONS = [
  {
    text: "大创报销发票抬头和税号写什么？",
    icon: "invoice",
  },
  {
    text: "买 API 需要准备哪些材料？",
    icon: "api",
  },
  {
    text: "哪些东西不能报销？",
    icon: "ban",
  },
  {
    text: "办公用品和图书要签领表吗？",
    icon: "sign",
  },
] as const;

export function StudentQaPanel() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [matchedRules, setMatchedRules] = useState<MatchedRule[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setAnswer(null);
    setMatchedRules([]);

    try {
      const res = await fetch("/api/student/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        answer?: string;
        matchedRules?: MatchedRule[];
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "请求失败");
      }
      setAnswer(data.answer ?? "");
      setMatchedRules(data.matchedRules ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "答疑失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <p className="student-qa-section-label">你的问题</p>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={5}
          placeholder="例如：电子发票怎么打印？云服务费要提交什么材料？"
          className="student-qa-textarea"
          required
          maxLength={2000}
        />
        <div className="student-qa-submit-wrap">
          <button type="submit" disabled={loading || !question.trim()} className="student-btn-primary" style={{ maxWidth: "none", minWidth: "9rem" }}>
            <ChatIcon />
            {loading ? "生成中…" : "开始提问"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="student-warn-text" role="alert">
          {error}
        </p>
      ) : null}

      {answer ? (
        <div className="student-qa-answer">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">回答</p>
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{answer}</p>
          {matchedRules.length > 0 ? (
            <ul className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-700">
              {matchedRules.map((r) => (
                <li key={r.rule_id} className="border-l-2 border-[var(--accent-green)] pl-3">
                  <span className="font-semibold">{r.rule_id}</span> · {r.category}
                  {r.risk_tags.length > 0 ? <span className="text-slate-500">（{r.risk_tags.join("、")}）</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <p className="student-qa-section-label" style={{ marginTop: answer ? "2rem" : "0.5rem" }}>
        猜你想问
      </p>
      <div className="student-qa-suggestions">
        {SUGGESTIONS.map((item) => (
          <button key={item.text} type="button" onClick={() => setQuestion(item.text)} className="student-qa-suggestion">
            <span className="student-qa-suggestion-icon">
              <SuggestionIcon kind={item.icon} />
            </span>
            {item.text}
          </button>
        ))}
      </div>

      <p className="student-qa-disclaimer">
        <InfoIcon />
        本问答基于学校财务制度与相关规定生成，仅供参考；最终报销审核以教师审批意见为准。
      </p>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 15 4.5v6a1.5 1.5 0 0 1-1.5 1.5H8l-3 3v-3H4.5A1.5 1.5 0 0 1 3 10.5v-6Z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-4 w-4 shrink-0" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7v4M8 5.5v.5" strokeLinecap="round" />
    </svg>
  );
}

function SuggestionIcon({ kind }: { kind: (typeof SUGGESTIONS)[number]["icon"] }) {
  const cls = "h-4 w-4";
  switch (kind) {
    case "invoice":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={cls} stroke="currentColor" strokeWidth="1.5">
          <path d="M4 2h8v12l-2-1.5L8 14l-2-1.5L4 14V2Z" />
        </svg>
      );
    case "api":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={cls} stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="10" height="8" rx="1" />
          <path d="M6 8h4" strokeLinecap="round" />
        </svg>
      );
    case "ban":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={cls} stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="5.5" />
          <path d="M5 5l6 6" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" fill="none" className={cls} stroke="currentColor" strokeWidth="1.5">
          <path d="M4 3h8v10H4V3Z" />
          <path d="M7 7h5M7 10h3" strokeLinecap="round" />
        </svg>
      );
  }
}
