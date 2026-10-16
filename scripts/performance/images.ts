import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

async function walk(dir: string, files: string[] = []) {
  try {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full, files)
      else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(full)
    }
  } catch {}
  return files
}

export async function collectImageHints(root = '.') {
  const files = await walk(root)
  let imageComponents = 0
  let rawImg = 0
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    imageComponents += (source.match(/<Image\b/g) ?? []).length
    rawImg += (source.match(/<img\b/g) ?? []).length
  }
  return { status: 'MEASURED', nextImageComponents: imageComponents, rawImgElements: rawImg }
}
