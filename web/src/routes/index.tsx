import { createFileRoute } from '@tanstack/react-router'
import { ArrowDown, ArrowRight, ArrowUpRight, Github } from 'lucide-react'
import AnimatedGradient from '#/components/animated-gradient'
import { ExplainDemo } from '#/components/explain-demo'
import { HeroGlass } from '#/components/hero-glass'
import { InstallCommand } from '#/components/install-command'
import { Sentence } from '#/components/sentence'
import { MISSING_URL, REPORT_URL, REPO_URL, SITE } from '#/site'

// Each page names its own canonical address; one set on the root would be inherited by every page and name the home
// page as the original of all of them.
export const Route = createFileRoute('/')({
  head: () => ({ links: [{ rel: 'canonical', href: SITE }] }),
  component: Home,
})

function Home() {
  return (
    // past this the hero's line length and the demo's two columns stop reading as one page
    <main className="mx-auto min-h-screen max-w-[1600px] bg-bg pb-32">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10 lg:px-14">
        <a href="/" className="font-mono text-[15px] tracking-[0.04em] text-ink">
          cmd-facts
        </a>
        <nav className="flex items-center gap-6">
          <a href="/react" className="text-[15px] text-ink-2 transition-colors hover:text-ink">
            React
          </a>
          <a href="/docs" className="text-[15px] text-ink-2 transition-colors hover:text-ink">
            Docs
          </a>
          <a
            href={REPO_URL}
            aria-label="cmd-facts on GitHub"
            className="text-ink-2 transition-colors hover:text-ink"
          >
            <Github aria-hidden className="size-[19px]" />
          </a>
        </nav>
      </header>

      {/* the hero card: mist is its surface, and the only light on the page */}
      <section className="relative isolate mx-4 overflow-hidden rounded-[28px] sm:mx-8 lg:mx-14">
        <AnimatedGradient config={{ preset: 'Mist' }} radius="28px" noise={{ opacity: 0.35 }} />
        <HeroGlass />
        <div
          data-glass-text
          className="relative flex min-h-[620px] flex-col justify-between p-8 sm:p-12 lg:p-16"
        >
          <div className="pt-10 lg:pt-16">
            <h1 data-lens="blob" className="max-w-[16ch] text-[clamp(2.35rem,5.2vw,4.6rem)] font-light leading-[1.02] tracking-[-0.038em] text-white">
              Structured facts about what a command does.
            </h1>
            <p data-lens="pill" className="mt-7 max-w-[44ch] text-[17px] leading-relaxed text-white/70 sm:text-[19px]">
              For the person who has to approve it and did not write it.{' '}
              <span className="font-mono text-[0.92em] text-white/55">explain()</span> returns typed
              fields — effect, reversibility, network reach, privilege — and no score.
            </p>
          </div>

          <div className="mt-14 flex flex-col items-start gap-8 lg:flex-row lg:items-end lg:justify-between">
            {/* the one thing the glass leaves alone: it is a control, not a picture */}
            <div data-no-glass>
              <InstallCommand />
            </div>
            {/* a control, like the card: the glass passes behind it and leaves it alone */}
            <a
              data-no-glass
              href="#try"
              className="group flex items-center gap-2.5 border-b border-white/25 pb-1.5 text-[15px] font-medium text-white/85 transition-colors hover:border-pink hover:text-white"
            >
              Try any command below
              <ArrowDown className="size-[18px] transition-transform group-hover:translate-y-0.5" />
            </a>
          </div>
        </div>
      </section>

      {/* the way in for a React app: the one-line usage, drawn by the real component, all of it one link */}
      <section className="mx-4 mt-8 sm:mx-8 lg:mx-14">
        <a
          href="/react"
          className="group grid gap-8 rounded-2xl border border-line bg-panel px-6 py-8 transition-colors hover:border-line-2 hover:bg-panel-2 sm:px-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-16 lg:py-10"
        >
          <div>
            <p className="eyebrow">shadcn registry</p>
            <h2 className="mt-3 text-[clamp(1.9rem,3.4vw,3rem)] font-light leading-[1.05] tracking-[-0.03em] text-ink">
              Use React?
            </h2>
            <p className="mt-4 max-w-[42ch] text-[16px] leading-relaxed text-ink-2">
              Show what a command does in one line. The components install into your app with shadcn, styled with your
              theme.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-[15px] font-medium text-ink transition-colors group-hover:text-pink">
              See the React components
              <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
          <div className="min-w-0 rounded-xl border border-line bg-bg px-5 py-5 sm:px-6">
            <p className="font-mono text-[13px] break-words text-ink-2 sm:text-[14px]">
              <span className="text-ink">&lt;Sentence</span> command=
              <span className="text-[#9fc7ff]">&quot;rm -rf ./build&quot;</span>{' '}
              <span className="text-ink">/&gt;</span>
            </p>
            <p className="mt-4 border-t border-line pt-4 text-[18px] font-light leading-snug text-ink sm:text-[20px]">
              <Sentence command="rm -rf ./build" />
            </p>
          </div>
        </a>
      </section>

      <section id="try" className="mx-4 mt-24 scroll-mt-8 sm:mx-8 lg:mx-14">
        <ExplainDemo />
        {/* the demo answers any line typed into it, so the page has to say how complete the table is */}
        <p className="mt-5 max-w-[78ch] text-[14px] leading-relaxed text-ink-3">
          The table is still small, so an answer here can be incomplete or wrong.{' '}
          <a
            href={REPORT_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-baseline gap-0.5 border-b border-ink-3/40 text-ink-2 transition-colors hover:border-pink hover:text-ink"
          >
            Report an inaccurate explanation
            <ArrowUpRight aria-hidden className="size-[13px] translate-y-px" />
          </a>
        </p>
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

      <footer className="mx-4 mt-24 border-t border-line pt-8 sm:mx-8 lg:mx-14">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-[46ch] text-[14px] leading-relaxed text-ink-3">
            Early stage. The table is still small, so an explanation can be incomplete or wrong.
            Reports are what fix a row.
          </p>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-ink-2">
            <a href="/docs" className="transition-colors hover:text-ink">
              Docs
            </a>
            <a href="/react" className="transition-colors hover:text-ink">
              React
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-ink">
              GitHub
            </a>
            <a href={REPORT_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-pink">
              Report an inaccurate explanation
            </a>
            <a href={MISSING_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-pink">
              Report a command with no row
            </a>
          </nav>
        </div>
        <p className="mt-8 pb-2 font-mono text-[12px] text-ink-3/70">MIT · no runtime dependencies</p>
      </footer>
    </main>
  )
}
