const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (file === 'route.ts') {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      const methods = ['GET'];
      let modified = false;
      
      for (const method of methods) {
        // If export async function GET exists
        const regex = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`, 'g');
        if (regex.test(content)) {
          // If no import, add it
          if (!content.includes("import { withAudit }")) {
             content = `import { withAudit } from '@/lib/audit-wrapper'\n` + content;
          }
          
          const moduleMatch = fullPath.match(/api\/([^\/]+)/);
          const moduleName = moduleMatch ? moduleMatch[1] : 'System';

          content = content.replace(regex, `async function ${method}_HANDLER(`);
          content += `\nexport const ${method} = withAudit('${moduleName}', ${method}_HANDLER);\n`;
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(fullPath, content);
        console.log(`Wrapped GET in ${fullPath}`);
      }
    }
  }
}

processDir('./src/app/api');
