import { createFileRoute, notFound } from '@tanstack/react-router'
import { DocsPage } from '#/components/docs/DocsPage'
import { getDoc } from '#/lib/docs'
import { docHead } from './-head'

export const Route = createFileRoute('/docs/')({
  loader: () => {
    if (!getDoc('')) throw notFound()
  },
  head: () => docHead(getDoc('')),
  component: () => <DocsPage doc={getDoc('')!} />,
})
