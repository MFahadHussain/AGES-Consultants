const fs = require('fs');

let content = fs.readFileSync('src/app/api/vouchers/route.ts', 'utf8');

if (!content.includes("withAudit")) {
  content = "import { withAudit } from '@/lib/audit-wrapper'\n" + content;
  
  content = content.replace(/export\s+async\s+function\s+POST\s*\(/g, "async function POST_HANDLER(");
  content += "\nexport const POST = withAudit('vouchers', POST_HANDLER);\n";
  
  fs.writeFileSync('src/app/api/vouchers/route.ts', content);
  console.log("Updated!");
} else {
  console.log("Already wrapped.");
}
