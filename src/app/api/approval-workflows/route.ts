import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/approval-workflows - List workflows
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const moduleFilter = searchParams.get('module')
    const isActive = searchParams.get('isActive')
    const includeInstances = searchParams.get('includeInstances') === 'true'
    const includeSteps = searchParams.get('includeSteps') === 'true' || includeInstances

    const where: Record<string, unknown> = {}
    if (moduleFilter) where.module = moduleFilter
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    const workflows = await db.approvalWorkflow.findMany({
      where,
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
      include: {
        steps: includeSteps ? { orderBy: { stepNumber: 'asc' } } : false,
        _count: {
          select: { steps: true, instances: true },
        },
        ...(includeInstances ? {
          instances: {
            where: { status: 'pending' },
            include: {
              steps: {
                include: {
                  approver: { select: { id: true, name: true, email: true } },
                },
                orderBy: { stepNumber: 'asc' },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        } : {}),
      },
    })

    const data = workflows.map((wf) => ({
      id: wf.id,
      name: wf.name,
      code: wf.code,
      description: wf.description,
      module: wf.module,
      entityType: wf.entityType,
      isActive: wf.isActive,
      createdBy: wf.createdBy,
      stepCount: (wf as any).steps?.length || wf._count.steps,
      instanceCount: wf._count.instances,
      steps: includeSteps ? (wf as any).steps : undefined,
      instances: includeInstances ? (wf as any).instances : undefined,
      createdAt: wf.createdAt,
      updatedAt: wf.updatedAt,
    }))

    // Get active instances separately if requested
    let activeInstances: any[] = []
    if (includeInstances) {
      const instances = await db.approvalInstance.findMany({
        where: { status: 'pending' },
        include: {
          workflow: { select: { id: true, name: true, code: true } },
          steps: {
            include: {
              approver: { select: { id: true, name: true, email: true } },
            },
            orderBy: { stepNumber: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      activeInstances = instances.map((inst) => ({
        id: inst.id,
        workflowId: inst.workflowId,
        workflowName: inst.workflow.name,
        workflowCode: inst.workflow.code,
        entityId: inst.entityId,
        entityType: inst.entityType,
        entityNumber: inst.entityNumber,
        currentStep: inst.currentStep,
        totalSteps: inst.totalSteps,
        status: inst.status,
        requestedBy: inst.requestedBy,
        requestedAt: inst.requestedAt,
        steps: inst.steps,
        age: Math.floor((Date.now() - new Date(inst.requestedAt).getTime()) / 60000),
      }))
    }

    const result: any = { success: true, data }
    if (includeInstances) {
      result.activeInstances = activeInstances
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching approval workflows:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch approval workflows' }, { status: 500 })
  }
}

// POST /api/approval-workflows - Create workflow with steps
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, code, description, module: wfModule, entityType, isActive, createdBy, steps } = body

    if (!name || !code || !entityType) {
      return NextResponse.json(
        { success: false, error: 'name, code, and entityType are required' },
        { status: 400 }
      )
    }

    const existing = await db.approvalWorkflow.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ success: false, error: 'Workflow code already exists' }, { status: 409 })
    }

    if (steps && !Array.isArray(steps)) {
      return NextResponse.json({ success: false, error: 'steps must be an array' }, { status: 400 })
    }

    const workflow = await db.approvalWorkflow.create({
      data: {
        name,
        code,
        description: description || null,
        module: wfModule || 'general',
        entityType,
        isActive: isActive ?? true,
        createdBy: createdBy || null,
        steps: steps
          ? {
              create: steps.map((step: {
                stepNumber: number; stepName: string; stepType?: string;
                approverRoleId?: string; approverUserId?: string; condition?: string;
                isParallel?: boolean; escalationMinutes?: number; escalationTo?: string; isRequired?: boolean;
              }) => ({
                stepNumber: step.stepNumber,
                stepName: step.stepName,
                stepType: step.stepType || 'role',
                approverRoleId: step.approverRoleId || null,
                approverUserId: step.approverUserId || null,
                condition: step.condition || null,
                isParallel: step.isParallel ?? false,
                escalationMinutes: step.escalationMinutes || null,
                escalationTo: step.escalationTo || null,
                isRequired: step.isRequired ?? true,
              })),
            }
          : undefined,
      },
      include: {
        steps: { orderBy: { stepNumber: 'asc' } },
      },
    })

    try {
      await db.auditLog.create({
        data: {
          action: 'CREATE', entity: 'ApprovalWorkflow', entityId: workflow.id, entityName: workflow.name,
          details: JSON.stringify({ code, module: wfModule, entityType, stepCount: steps?.length || 0 }),
          module: 'security', severity: 'info',
        },
      })
    } catch {}

    return NextResponse.json({ success: true, data: workflow }, { status: 201 })
  } catch (error) {
    console.error('Error creating approval workflow:', error)
    return NextResponse.json({ success: false, error: 'Failed to create approval workflow' }, { status: 500 })
  }
}
