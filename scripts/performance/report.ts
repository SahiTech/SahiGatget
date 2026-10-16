import { writeFile } from 'node:fs/promises'

export async function writeReports(report: unknown) {
  await writeFile('performance-report.json', JSON.stringify(report, null, 2) + '\n', 'utf8')
  const escaped = JSON.stringify(report).replace(/</g, '\\u003c')
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>PhonerBazar Performance Report</title><style>body{font:14px system-ui;max-width:1100px;margin:40px auto;padding:0 20px}pre{white-space:pre-wrap;background:#f6f7f9;padding:16px;border-radius:10px}</style></head><body><h1>PhonerBazar Performance Report</h1><pre>' + escaped + '</pre></body></html>'
  await writeFile('performance-report.html', html, 'utf8')
}
