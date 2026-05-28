import { AiPreauditForm } from "@/components/AiPreauditForm";

export const metadata = {
  title: "提交申报 | 学生端",
  description: "学生提交大创报销合规申报与凭证。",
};

export default function StudentPreauditPage() {
  return (
    <div className="student-page-shell">
      <section className="student-glass-panel student-submit-panel">
        <div className="student-page-heading student-page-heading--left">
          <p>学生端 <span>/</span> 提交申报</p>
          <h1>提交报销申报</h1>
          <strong>请填写项目信息并上传报销相关凭证，以便审核入库与后续处理。</strong>
        </div>
        <AiPreauditForm portal="student" />
      </section>
    </div>
  );
}
