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
      
      // Check if it has POST, PUT, DELETE, PATCH exports
      if (!/(export async function (POST|PUT|DELETE|PATCH))/.test(content)) {
         continue;
      }

      // If already wrapped, skip
      if (content.includes('withAudit(')) continue;

      const importStmt = `import { withAudit } from '@/lib/audit-wrapper'\n`;
      content = importStmt + content;

      // Determine module name from directory path
      const moduleMatch = fullPath.match(/api\/([^\/]+)/);
      const moduleName = moduleMatch ? moduleMatch[1] : 'System';

      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        const regex = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`, 'g');
        if (regex.test(content)) {
          content = content.replace(regex, `async function ${method}_HANDLER(`);
          content += `\nexport const ${method} = withAudit('${moduleName}', ${method}_HANDLER);\n`;
        }
      }

      fs.writeFileSync(fullPath, content);
      console.log(`Wrapped ${fullPath}`);
    }
  }
}

processDir('./src/app/api');
