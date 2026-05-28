import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "学生端 | 大创报销合规风控",
  description: "学生提交报销申报、查询复核进度。",
};

export default function StudentHomePage() {
  return (
    <div className="student-page-shell student-home-shell">
      <section className="student-glass-panel student-home-panel">
        <div className="student-home-hero">
          <BrandShieldIcon />
          <h1>学生端报销工作台</h1>
          <p>上传材料、完成申报、智能答疑，让报销更规范。</p>
        </div>

        <div className="student-home-actions">
          <StudentActionCard
            href="/student/preaudit"
            title="提交申报"
            desc="上传发票 / 付款截图 / PDF材料"
            cta="开始提交"
            icon={<SubmitDocIcon />}
          />
          <StudentActionCard
            href="/student/qa"
            title="AI问答"
            desc="报销规则检索与智能合规答疑"
            cta="开始问答"
            icon={<ChatIcon />}
          />
          <StudentActionCard
            href="/student/status"
            title="查询进度"
            desc="查看AI初审、教师复核与整改状态"
            cta="查看进度"
            icon={<SearchStatusIcon />}
          />
        </div>

        <div className="student-home-lower">
          <section className="student-home-card student-flow-card">
            <h2><span />报销流程</h2>
            <ol>
              {[
                ["填写申报", <WriteIcon key="write" />],
                ["上传凭证", <CloudUploadIcon key="upload" />],
                ["AI问答", <BubbleIcon key="bubble" />],
                ["提交导师", <UserSolidIcon key="user" />],
                ["查看反馈", <MessageIcon key="message" />],
              ].map(([label, icon], index) => (
                <li key={String(label)}>
                  <span className="student-flow-icon">{icon}</span>
                  <span className="student-flow-num">{index + 1}</span>
                  <strong>{label}</strong>
                </li>
              ))}
            </ol>
            <p className="student-flow-note">
              <LightIcon /> AI 初审 + 教师复核双重把关，确保合规高效
            </p>
          </section>

          <section className="student-home-card student-check-card">
            <h2><span />提交前检查</h2>
            <ul>
              {["发票清晰", "付款记录完整", "金额一致", "用途相关", "特殊材料齐全"].map((item) => (
                <li key={item}><CheckCircleIcon />{item}</li>
              ))}
            </ul>
            <div className="student-check-ghost" aria-hidden>
              <ClipboardShieldIcon />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function StudentActionCard({
  href,
  title,
  desc,
  cta,
  icon,
}: {
  href: string;
  title: string;
  desc: string;
  cta: string;
  icon: ReactNode;
}) {
  return (
    <article className="student-action-card">
      <span className="student-action-icon">{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{desc}</p>
        <Link href={href} className="student-primary-btn">
          {cta}
        </Link>
      </div>
    </article>
  );
}

function BrandShieldIcon() {
  return (
    <span className="student-brand-shield">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/api/photos/brand" alt="审盾" />
    </span>
  );
}

function SubmitDocIcon() {
  return <svg viewBox="0 0 32 32"><path d="M9 5h12l4 4v18H9V5Z" /><path d="M21 5v5h5M13 14h9M13 18h7" /><circle cx="23" cy="23" r="4" /><path d="M23 25v-5m0 0-2 2m2-2 2 2" /></svg>;
}
function ChatIcon() {
  return <svg viewBox="0 0 32 32"><path d="M8 9c0-3 3-5 8-5s8 2 8 5v4c0 3-3 5-8 5h-2l-5 4v-5c-1.4-.9-2-2.2-2-4V9Z" /><circle cx="13" cy="11" r="1" /><circle cx="17" cy="11" r="1" /><circle cx="21" cy="11" r="1" /><circle cx="23" cy="21" r="5" /><path d="M21 21h4" /></svg>;
}
function SearchStatusIcon() {
  return <svg viewBox="0 0 32 32"><circle cx="14" cy="14" r="8" /><path d="m20 20 6 6M10 15l3 3 5-7" /></svg>;
}
function WriteIcon() {
  return <svg viewBox="0 0 32 32"><path d="M8 5h13l4 4v18H8V5Z" /><path d="M21 5v5h5M12 15h7M12 20h5M20 22l6-6 2 2-6 6-3 1 1-3Z" /></svg>;
}
function CloudUploadIcon() {
  return <svg viewBox="0 0 32 32"><path d="M11 24H9a6 6 0 0 1 0-12 8 8 0 0 1 15.5 2.5A5 5 0 0 1 23 24h-2" /><path d="M16 25V15m0 0-4 4m4-4 4 4" /></svg>;
}
function BubbleIcon() {
  return <svg viewBox="0 0 32 32"><path d="M7 10c0-3 3.5-5.5 9-5.5s9 2.5 9 5.5v3c0 3-3.5 5.5-9 5.5h-2l-5 4v-5c-1.4-1-2-2.4-2-4.5v-3Z" /><circle cx="12" cy="12" r="1" /><circle cx="16" cy="12" r="1" /><circle cx="20" cy="12" r="1" /></svg>;
}
function UserSolidIcon() {
  return <svg viewBox="0 0 32 32"><circle cx="16" cy="11" r="5" /><path d="M7 27c1-5.5 4.2-8 9-8s8 2.5 9 8H7Z" /></svg>;
}
function MessageIcon() {
  return <svg viewBox="0 0 32 32"><path d="M6 8h20v13H12l-6 5V8Z" /><path d="M11 13h10M11 17h7" /></svg>;
}
function LightIcon() {
  return <svg viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M8 14a6 6 0 1 1 8 0c-.8.8-1 1.5-1 2H9c0-.5-.2-1.2-1-2Z" /></svg>;
}
function CheckCircleIcon() {
  return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m8 12 2.6 2.6L16 9" /></svg>;
}
function ClipboardShieldIcon() {
  return <svg viewBox="0 0 160 120"><rect x="42" y="18" width="62" height="86" rx="8" /><rect x="58" y="10" width="30" height="14" rx="4" /><path d="M57 45h34M57 62h28M57 79h22" /><path d="M116 45 144 57v18c0 17-12 27-28 34-16-7-28-17-28-34V57l28-12Z" /><path d="m105 76 8 8 17-19" /></svg>;
}
