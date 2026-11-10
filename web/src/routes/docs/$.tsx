import { createFileRoute, notFound } from '@tanstack/react-router'
import { DocsPage } from '#/components/docs/DocsPage'
import { getDoc } from '#/lib/docs'
import { docHead } from './-head'

export const Route = createFileRoute('/docs/$')({
  loader: ({ params }) => {
    if (!getDoc(params._splat ?? '')) throw notFound()
  },
  head: ({ params }) => docHead(getDoc(params._splat ?? '')),
  component: Page,
})

function Page() {
  const { _splat = '' } = Route.useParams()
  return <DocsPage doc={getDoc(_splat)!} />
}
