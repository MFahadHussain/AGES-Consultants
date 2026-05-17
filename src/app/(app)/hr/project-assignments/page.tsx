import type { Metadata } from 'next'
import { ProjectAssignmentsClient } from './_client'

export const metadata: Metadata = {
  title: 'Project Assignments',
}

export default function ProjectAssignmentsPage() {
  return <ProjectAssignmentsClient />
}
