import type { Metadata } from "next"

const dependencySections = [
  {
    title: "1. Required tooling",
    bullets: [
      "Node.js 18.18+ (LTS) with npm 10+ installed globally.",
      "PostgreSQL client utilities (psql or a GUI) for connectivity tests.",
      "Git for version control.",
    ],
  },
  {
    title: "2. Install project packages",
    bullets: [
      "From the repository root, run `npm install` to pull all workspace dependencies declared in `package.json`.",
      "If you prefer pnpm or yarn, ensure the respective lockfile is generated and committed before switching.",
      "Use `npm update <package>` when a targeted upgrade is required - broad `npm update` runs should be coordinated with the team.",
    ],
  },
  {
    title: "3. Validate optional services",
    bullets: [
      "LLM access: set the `GEMINI_API_KEY` value in `.env.local` and run `npm run lint` to ensure TypeScript picks up the env definition.",
      "Email login (if enabled): configure SMTP credentials via `RESEND_API_KEY` or your provider of choice.",
      "Object storage: update `BLOB_STORAGE_URL` and related keys when exporting handoff artifacts to S3-compatible storage.",
    ],
  },
  {
    title: "4. Keep dependencies healthy",
    bullets: [
      "Run `npm run lint` and `npm run test` after package updates to catch regressions.",
      "Use `npx npm-check-updates` locally to review available upgrades before committing changes.",
      "Security scan periodically with `npx snyk test` (requires Snyk CLI) or your preferred SCA tool.",
    ],
  },
]

export const metadata: Metadata = {
  title: "Dependencies | Spec-Driven",
  description: "Install and maintain the tooling required to develop Spec-Driven.",
}

export default function DependenciesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 lg:px-0">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary uppercase tracking-wide">Guides</p>
        <h1 className="text-3xl font-semibold text-foreground">Dependencies</h1>
        <p className="text-muted-foreground">
          Everything you need to install before contributing to Spec-Driven, plus best practices for keeping the toolchain
          secure and reproducible.
        </p>
      </div>

      <div className="mt-10 space-y-8">
        {dependencySections.map((section) => (
          <section key={section.title} className="rounded-lg border border-border/60 bg-card/60 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
            <ul className="mt-4 list-disc space-y-3 pl-5 text-sm text-muted-foreground">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
