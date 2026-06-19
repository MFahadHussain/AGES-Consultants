import fs from 'fs'
import path from 'path'

const SRC_DIR = path.join(process.cwd(), 'src')

// Tailwind class replacements and hardcoded hex replacements
const replacements: [RegExp | string, string][] = [
  // Exact class replacements (word boundary matches)
  [/\bbg-green-600\b/g, 'bg-[#0F2D78]'],
  [/\bbg-green-700\b/g, 'bg-[#0A1F54]'],
  [/\bbg-green-500\b/g, 'bg-[#1E3C87]'],
  [/\bbg-green-100\b/g, 'bg-[#EEF1F8]'],
  [/\bbg-green-50\b/g, 'bg-[#EEF1F8]'],
  [/\btext-green-600\b/g, 'text-[#0F2D78]'],
  [/\btext-green-700\b/g, 'text-[#0A1F54]'],
  [/\btext-green-500\b/g, 'text-[#1E3C87]'],
  [/\btext-green-400\b/g, 'text-[#96A5C3]'],
  [/\bborder-green-600\b/g, 'border-[#0F2D78]'],
  [/\bborder-green-500\b/g, 'border-[#1E3C87]'],
  [/\bborder-green-200\b/g, 'border-[#A5B4D2]'],
  [/\bring-green-600\b/g, 'ring-[#0F2D78]'],
  [/\bhover:bg-green-700\b/g, 'hover:bg-[#0A1F54]'],
  [/\bhover:bg-green-600\b/g, 'hover:bg-[#1E3C87]'],
  [/\bhover:text-green-600\b/g, 'hover:text-[#0F2D78]'],
  [/\bfocus:ring-green-500\b/g, 'focus:ring-[#0F2D78]'],
  [/\bdivide-green-200\b/g, 'divide-[#A5B4D2]'],
  [/\bfrom-green-600\b/g, 'from-[#0F2D78]'],
  [/\bto-green-700\b/g, 'to-[#0A1F54]'],
  [/\bvia-green-500\b/g, 'via-[#1E3C87]'],

  // Additional green classes found in codebase search
  [/\btext-green-800\b/g, 'text-[#0F2D78]'],
  [/\btext-green-900\b/g, 'text-[#0A1F54]'],
  [/\bbg-green-800\b/g, 'bg-[#0F2D78]'],
  [/\bbg-green-50\/20\b/g, 'bg-[#EEF1F8]/20'],
  [/\bbg-green-900\/30\b/g, 'bg-[#0F2D78]/30'],
  [/\bborder-l-green-500\b/g, 'border-l-[#0F2D78]'],
  [/\bborder-green-400\b/g, 'border-[#0F2D78]'],
  [/\btext-green-500\/80\b/g, 'text-[#1E3C87]/80'],
  [/\btext-emerald-600\b/g, 'text-[#0F2D78]'],
  [/\bbg-emerald-600\b/g, 'bg-[#0F2D78]'],
  [/\bbg-emerald-100\b/g, 'bg-[#EEF1F8]'],
  [/\btext-emerald-800\b/g, 'text-[#0F2D78]'],
  [/\bborder-emerald-200\b/g, 'border-[#A5B4D2]'],

  // Hardcoded hex codes (case-insensitive)
  [/#16a34a/gi, '#0F2D78'],
  [/#15803d/gi, '#0A1F54'],
  [/#22c55e/gi, '#1E3C87'],
  [/#4ade80/gi, '#96A5C3'],
  [/#dcfce7/gi, '#EEF1F8'],
  [/#1a7a4a/gi, '#0F2D78'],
  [/#2e7d32/gi, '#0F2D78'],
  [/#15693F/gi, '#0A1F54'],
  [/#F0FDF4/gi, '#EEF1F8'],
  [/#f0fdf4/gi, '#EEF1F8'],

  // Specific RGB colors
  [/rgb\(22,\s*163,\s*74\)/gi, 'rgb(15, 45, 120)'],

  // Inline styling green keyword color replacements (avoiding false matches inside words)
  [/color:\s*['"]green['"]/g, 'color: "#0F2D78"'],
  [/stroke:\s*['"]green['"]/g, 'stroke: "#0F2D78"'],
  [/fill:\s*['"]green['"]/g, 'fill: "#0F2D78"'],
]

function scanDirectory(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      scanDirectory(filePath, fileList)
    } else {
      const ext = path.extname(file)
      if (['.ts', '.tsx', '.css', '.html', '.js'].includes(ext)) {
        fileList.push(filePath)
      }
    }
  }
  return fileList
}

function rebrandColors() {
  console.log('Scanning src directory for files...')
  const files = scanDirectory(SRC_DIR)
  console.log(`Found ${files.length} files to scan.`)

  let processedCount = 0
  let totalReplacementsCount = 0

  for (const file of files) {
    // Skip globals.css itself since we modified it manually and it contains raw custom definitions
    if (file.endsWith('globals.css')) continue

    let content = fs.readFileSync(file, 'utf8')
    let original = content
    let fileReplacementsCount = 0

    for (const [pattern, replacement] of replacements) {
      if (typeof pattern === 'string') {
        if (content.includes(pattern)) {
          // Simple replacement count
          const count = (content.split(pattern).length - 1)
          fileReplacementsCount += count
          content = content.replaceAll(pattern, replacement)
        }
      } else {
        const matches = content.match(pattern)
        if (matches) {
          fileReplacementsCount += matches.length
          content = content.replace(pattern, replacement)
        }
      }
    }

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8')
      const relativePath = path.relative(process.cwd(), file)
      console.log(`Updated ${relativePath}: ${fileReplacementsCount} replacements made.`)
      processedCount++
      totalReplacementsCount += fileReplacementsCount
    }
  }

  // Also do specific replacements in other user-facing pages if necessary
  // e.g. attendance.html
  const attendanceHtmlPath = path.join(process.cwd(), 'attendance.html')
  if (fs.existsSync(attendanceHtmlPath)) {
    let content = fs.readFileSync(attendanceHtmlPath, 'utf8')
    let original = content
    for (const [pattern, replacement] of replacements) {
      content = content.replace(pattern as any, replacement)
    }
    if (content !== original) {
      fs.writeFileSync(attendanceHtmlPath, content, 'utf8')
      console.log('Updated attendance.html')
      processedCount++
    }
  }

  console.log(`\nRebranding complete. Updated ${processedCount} files with ${totalReplacementsCount} color substitutions.`)
}

rebrandColors()
