import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/approval-workflows/[id] - Update workflow
async function PUT_HANDLER(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, module: mod, entityType, isActive, steps } = body

    const existing = await db.approvalWorkflow.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Workflow not found' }, { status: 404 })
    }

    // Update basic fields
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (mod !== undefined) updateData.module = mod
    if (entityType !== undefined) updateData.entityType = entityType
    if (isActive !== undefined) updateData.isActive = isActive

    if (Object.keys(updateData).length > 0) {
      await db.approvalWorkflow.update({
        where: { id },
        data: updateData,
      })
    }

    // If steps provided, replace them
    if (steps && Array.isArray(steps)) {
      await db.workflowStep.deleteMany({ where: { workflowId: id } })
      await db.workflowStep.createMany({
        data: steps.map((s: any, i: number) => ({
          workflowId: id,
          stepNumber: s.stepNumber || i + 1,
          stepName: s.stepName || `Step ${i + 1}`,
          stepType: s.stepType || 'role',
          approverRoleId: s.approverRoleId || null,
          approverUserId: s.approverUserId || null,
          condition: s.condition || null,
          isParallel: s.isParallel || false,
          escalationMinutes: s.escalationMinutes || null,
          escalationTo: s.escalationTo || null,
          isRequired: s.isRequired !== false,
        })),
      })
    }

    const workflow = await db.approvalWorkflow.findUnique({
      where: { id },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    })

    try {
      await db.auditLog.create({
        data: {
          action: 'UPDATE', entity: 'ApprovalWorkflow', entityId: id, entityName: existing.name,
          details: JSON.stringify({ updatedFields: Object.keys(updateData), stepsUpdated: !!steps }),
          module: 'security', severity: 'info',
        },
      })
    } catch {}

    return NextResponse.json({ success: true, data: workflow })
  } catch (error) {
    console.error('Error updating approval workflow:', error)
    return NextResponse.json({ success: false, error: 'Failed to update approval workflow' }, { status: 500 })
  }
}

export const PUT = withAudit('approval-workflows', PUT_HANDLER);
