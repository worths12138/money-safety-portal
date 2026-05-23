const DEFAULT_TITLE = "经费合规风控报告";

export function buildReportDocumentTitle(reportId: string, projectName?: string) {
  const name = projectName?.trim();
  return name ? `${DEFAULT_TITLE} - ${name}` : `${DEFAULT_TITLE} - ${reportId}`;
}

export function exportReportPdf(options: {
  reportId: string;
  projectName?: string;
  onPrepare?: () => void;
  onFinish?: () => void;
}) {
  const previousTitle = document.title;
  document.title = buildReportDocumentTitle(options.reportId, options.projectName);
  options.onPrepare?.();

  const runPrint = () => {
    window.print();
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(runPrint);
  });

  const finish = () => {
    document.title = previousTitle;
    options.onFinish?.();
    window.removeEventListener("afterprint", finish);
  };

  window.addEventListener("afterprint", finish);
}
