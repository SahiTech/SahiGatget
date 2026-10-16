import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

async function walk(dir: string, files: string[] = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(full, files)
    else files.push(full)
  }
  return files
}

export async function collectBundleMetrics(root = '.next') {
  try {
    const files = await walk(root)
    const js = await Promise.all(files.filter((file) => file.endsWith('.js')).map(async (file) => ({
      file,
      bytes: (await stat(file)).size,
    })))
    const total = js.reduce((sum, item) => sum + item.bytes, 0)
    return { status: 'MEASURED', javascriptBytes: total, javascriptFiles: js.length, largestFiles: js.sort((a, b) => b.bytes - a.bytes).slice(0, 10) }
  } catch {
    return { status: 'NOT MEASURED', reason: '.next output is unavailable. Run after a successful production build.' }
  }
}
