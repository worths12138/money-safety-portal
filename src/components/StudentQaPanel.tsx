"use client";

import { type FormEvent, useState } from "react";

type MatchedRule = {
  rule_id: string;
  category: string;
  risk_level: string;
  risk_tags: string[];
  source: string;
};

const EXAMPLES = [
  "大创报销发票抬头和税号有什么要求？",
  "买 DeepSeek API 需要准备哪些材料？",
  "哪些东西不能报销？",
  "办公用品和图书要签领表吗？",
];

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
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">你的问题</span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            placeholder="例如：电子发票怎么打印？云服务费要交什么材料？"
            className="mt-2 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-400 focus:ring-2"
            required
            maxLength={2000}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuestion(ex)}
              className="border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              {ex}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="border border-slate-900 bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "正在检索规则并生成回答…" : "提问"}
        </button>
      </form>

      {error && (
        <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {answer && (
        <div className="border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">回答</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-800">{answer}</p>
        </div>
      )}

      {matchedRules.length > 0 && (
        <div className="border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">本次命中规则</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {matchedRules.map((r) => (
              <li key={r.rule_id} className="border-l-2 border-slate-400 pl-3">
                <span className="font-semibold">{r.rule_id}</span> · {r.category}
                {r.risk_tags.length > 0 && (
                  <span className="text-slate-500">（{r.risk_tags.join("、")}）</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-500">
        本答疑基于学院制度整理的 14 条结构化规则库（关键词召回），仅供参考；正式审核以指导教师批复为准。
      </p>
    </div>
  );
}
