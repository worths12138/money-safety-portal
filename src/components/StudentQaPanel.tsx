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
  { text: "大创报销发票抬头和税号写什么？", icon: InvoiceIcon },
  { text: "买 API 需要准备哪些材料？", icon: ApiIcon },
  { text: "哪些东西不能报销？", icon: BanIcon },
  { text: "办公用品和图书要签领表吗？", icon: SignIcon },
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
    <div className="student-qa-form-wrap">
      <form onSubmit={handleSubmit} className="student-qa-form">
        <h2 className="student-section-title">你的问题</h2>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例如：电子发票怎么打印？云服务费要提交什么材料？"
          required
          maxLength={2000}
        />
        <button type="submit" disabled={loading || !question.trim()} className="student-primary-btn student-qa-submit">
          <ChatIcon />
          {loading ? "生成中…" : "开始提问"}
        </button>
      </form>

      {error ? (
        <p className="student-alert student-alert--error" role="alert">
          {error}
        </p>
      ) : null}

      {answer ? (
        <div className="student-answer-card">
          <p>回答</p>
          <div>{answer}</div>
          {matchedRules.length > 0 ? (
            <div className="student-rule-card">
              <p>本次命中规则</p>
              <ul>
                {matchedRules.map((r) => (
                  <li key={r.rule_id}>
                    <strong>{r.rule_id}</strong> · {r.category}
                    {r.risk_tags.length > 0 ? `（${r.risk_tags.join("、")}）` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="student-qa-examples">
        <h2 className="student-section-title">猜你想问</h2>
        <div>
          {SUGGESTIONS.map((item) => (
            <button key={item.text} type="button" onClick={() => setQuestion(item.text)}>
              <item.icon />
              {item.text}
            </button>
          ))}
        </div>
      </div>

      <p className="student-info-note">
        <InfoIcon />
        本问答基于学校财务制度与相关规定生成，仅供参考；最终报销审核以教师审批意见为准。
      </p>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-4 4v-4H6a2 2 0 0 1-2-2V6Z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6M12 7v1" />
    </svg>
  );
}

function InvoiceIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M6 3h10l4 4v14H6V3Z" />
      <path d="M10 11h8M10 15h5" />
    </svg>
  );
}

function ApiIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M8 12h8" />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" />
      <path d="M8 8l8 8" />
    </svg>
  );
}

function SignIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M5 4h12v16H5V4Z" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  );
}
