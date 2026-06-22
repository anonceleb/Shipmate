const TODAY = new Date().toISOString().slice(0, 10);

const PRINT_CSS = `
  body{font-family:Georgia,serif;max-width:680px;margin:40px auto;color:#1a1a1a;line-height:1.55;font-size:14px}
  .head{border-bottom:3px solid #1a6fb5;padding-bottom:12px;margin-bottom:24px}
  .co{font-size:20px;font-weight:bold;color:#1a6fb5;letter-spacing:1px}
  .sub{font-size:12px;color:#555}
  h2{font-size:16px;text-transform:uppercase;letter-spacing:1px}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  td,th{border:1px solid #bbb;padding:6px 10px;font-size:13px;text-align:left}
  th{background:#eef4fa}
  .ref{font-family:monospace;font-size:12px;color:#555}
  .sig{margin-top:48px}
  .demo{position:fixed;top:8px;right:12px;font-size:10px;color:#bbb;letter-spacing:2px}
  @media print {.noprint{display:none}}
`;

/**
 * Builds a printable artifact as a full HTML string.
 */
export function buildPrintableHtml(company, title, bodyHtml, refNo, date = TODAY) {
  return `<!doctype html><html><head><title>${title}</title><style>${PRINT_CSS}</style></head><body>
    <div class="demo">DEMO ARTIFACT — SYNTHETIC DATA</div>
    <div class="head">
      <div class="co">${company.name}</div>
      <div class="sub">${company.address}</div>
    </div>
    <div class="ref">Ref: ${refNo} &nbsp;·&nbsp; Date: ${date}</div>
    ${bodyHtml}
    <div class="sig">For <b>${company.name}</b><br/><br/><br/>Authorised Signatory</div>
    <button class="noprint" onclick="window.print()" style="margin-top:32px;padding:10px 24px;font-size:14px;cursor:pointer">Print / Save as PDF</button>
  </body></html>`;
}

/**
 * Opens a printable artifact in a new window (non-preview environments).
 */
export function openPrintable(company, title, bodyHtml, refNo, date = TODAY) {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return;
  w.document.write(buildPrintableHtml(company, title, bodyHtml, refNo, date));
  w.document.close();
}
