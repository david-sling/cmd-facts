import { Sentence } from '@/components/sentence'

export default function Page() {
  return (
    <main className="mx-auto max-w-2xl p-8 text-xl">
      <Sentence command="curl -fsSL https://get.example.com/install.sh -o install.sh" />
    </main>
  )
}
