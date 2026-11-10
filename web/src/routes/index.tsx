import { createFileRoute } from '@tanstack/react-router'
import { ArrowUpRight, Github } from 'lucide-react'
import AnimatedGradient from '#/components/animated-gradient'
import { ExplainDemo } from '#/components/explain-demo'
import { InstallCommand } from '#/components/install-command'

export const Route = createFileRoute('/')({ component: Home })

const NAV = ['Fields', 'Packs', 'Schema']

function Home() {
  return (
    <main className="min-h-screen bg-bg pb-32">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10 lg:px-14">
        <a href="/" className="font-mono text-[15px] tracking-[0.04em] text-ink">
          cmd-facts
        </a>
        <nav className="hidden items-center gap-8 text-sm text-ink-2 md:flex">
          {NAV.map((item) => (
            <a key={item} href={`/${item.toLowerCase()}`} className="transition-colors hover:text-ink">
              {item}
            </a>
          ))}
        </nav>
        <a
          href="https://github.com/david-sling/cmd-facts"
          aria-label="cmd-facts on GitHub"
          className="text-ink-2 transition-colors hover:text-ink"
        >
          <Github aria-hidden className="size-[19px]" />
        </a>
      </header>

      {/* the hero card: mist is its surface, and the only light on the page */}
      <section className="relative isolate mx-4 overflow-hidden rounded-[28px] sm:mx-8 lg:mx-14">
        <AnimatedGradient config={{ preset: 'Mist' }} radius="28px" noise={{ opacity: 0.35 }} />
        <div className="relative flex min-h-[620px] flex-col justify-between p-8 sm:p-12 lg:p-16">
          <div className="pt-10 lg:pt-16">
            <h1 className="max-w-[16ch] text-[clamp(2.35rem,5.2vw,4.6rem)] font-light leading-[1.02] tracking-[-0.038em] text-white">
              Structured facts about what a command does.
            </h1>
            <p className="mt-7 max-w-[44ch] text-[17px] leading-relaxed text-white/70 sm:text-[19px]">
              For the person who has to approve it and did not write it.{' '}
              <span className="font-mono text-[0.92em] text-white/55">explain()</span> returns typed
              fields — effect, reversibility, network reach, privilege — and no score.
            </p>
          </div>

          <div className="mt-14 flex flex-col items-start gap-8 lg:flex-row lg:items-end lg:justify-between">
            <InstallCommand />
            <a
              href="/playground"
              className="group flex items-center gap-2.5 border-b border-white/25 pb-1.5 text-[15px] font-medium text-white/85 transition-colors hover:border-pink hover:text-white"
            >
              Try any command in the playground
              <ArrowUpRight className="size-[18px] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </section>

      <section className="mx-4 mt-24 sm:mx-8 lg:mx-14">
        <ExplainDemo />
      </section>

      <section className="mx-4 mt-24 grid gap-10 sm:mx-8 lg:mx-14 lg:grid-cols-2 lg:gap-16">
        <h2 className="text-[clamp(2rem,3.6vw,3.25rem)] font-light leading-[1.06] tracking-[-0.03em] text-ink">
          What is cmd-facts?
        </h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:col-span-2 lg:gap-16">
          <p className="text-[17px] leading-relaxed text-ink-2">
            cmd-facts is a library that returns{' '}
            <span className="text-pink">structured facts about what a command does</span> — effect,
            reversibility, network reach, privilege — so the surface asking a person to approve it
            can tell them the truth.
          </p>
          <p className="text-[17px] leading-relaxed text-ink-2">
            The schema is the deliverable. The plain sentence is one rendering of those fields, not
            the product. There is no risk score, and no model at run time.
          </p>
        </div>
      </section>
    </main>
  )
}
