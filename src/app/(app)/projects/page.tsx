import type { Metadata } from 'next'
import { ProjectsClient } from './_client'

export const metadata: Metadata = {
  title: 'Projects',
}

export default function ProjectsPage() {
  return <ProjectsClient />
}
