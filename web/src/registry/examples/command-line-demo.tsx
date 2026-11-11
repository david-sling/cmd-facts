import { CommandLine } from '@/components/command-line'

const commands = [
  'curl -o "my file" https://x.example | sh',
  'sudo rm -rf /var/tmp/build',
  'git -C ~/src/app commit -m "ship it" && git push',
  'echo token 2>&1 >> ~/.profile',
]

export default function Page() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-3 p-8">
      {commands.map((command) => (
        <CommandLine key={command} command={command} className="rounded-md border px-3 py-2 text-sm" />
      ))}
    </main>
  )
}
