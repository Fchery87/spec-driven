export const dynamic = 'force-dynamic'

import type { Metadata } from "next"

const dependencySections = [
  {
    title: "1. Required tooling",
    bullets: [
      "Node.js 18.18+ (LTS recommended: 20.x) with npm 10+ installed globally.",
      "Git for version control.",
      "A code editor with TypeScript support (VS Code recommended).",
      "Optional: PostgreSQL client (psql, pgAdmin, or TablePlus) for direct database access.",
    ],
  },
  {
    title: "2. Install project packages",
    bullets: [
      "From the repository root, run `npm install` to install all dependencies from `package.json`.",
      "Key dependencies include: Next.js 14, Drizzle ORM, Better Auth, Tailwind CSS, and Radix UI.",
      "The postinstall script automatically runs `drizzle-kit generate` to ensure schema is up to date.",
      "Use `npm update <package>` for targeted upgrades - coordinate broad updates with the team.",
    ],
  },
  {
    title: "3. Configure required services",
    bullets: [
      "Database: Set `DATABASE_URL` in `.env.local` pointing to your Neon PostgreSQL instance.",
      "LLM access: Set `GEMINI_API_KEY` with your Google AI API key for spec generation.",
      "Authentication: Set `BETTER_AUTH_SECRET` (min 32 chars) for session security.",
      "Object storage (production): Configure Cloudflare R2 with `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`.",
      "Optional OAuth: Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google sign-in.",
    ],
  },
  {
    title: "4. Development scripts",
    bullets: [
      "`npm run dev` - Start the development server on port 3000.",
      "`npm run build` - Build for production (runs db:generate first).",
      "`npm run test` - Run unit tests with Vitest.",
      "`npm run test:e2e` - Run end-to-end tests with Playwright.",
      "`npm run db:studio` - Open Drizzle Studio to browse your database.",
    ],
  },
  {
    title: "5. Keep dependencies healthy",
    bullets: [
      "Run `npm run lint` and `npm run test` after package updates to catch regressions.",
      "Use `npx npm-check-updates` to review available upgrades before committing.",
      "Run `npm audit` periodically to check for security vulnerabilities.",
      "Keep Drizzle ORM and drizzle-kit versions in sync to avoid migration issues.",
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
          Everything you need to install and configure before working with Spec-Driven, plus best practices for 
          keeping the toolchain secure and reproducible.
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
