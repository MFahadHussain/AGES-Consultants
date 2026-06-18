import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const backupScriptPath = path.join(process.cwd(), "daily_backup.sh");
    
    // Execute the shell script
    const { stdout, stderr } = await execAsync(`"${backupScriptPath}"`);
    
    return NextResponse.json({
      success: true,
      message: "Backup completed successfully",
      stdout: stdout,
      stderr: stderr,
    });
  } catch (error: any) {
    console.error("Backup failed:", error);
    return NextResponse.json(
      { success: false, error: "Backup failed: " + error.message },
      { status: 500 }
    );
  }
}
