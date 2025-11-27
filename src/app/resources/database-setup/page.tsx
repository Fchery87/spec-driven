export const dynamic = 'force-dynamic'

import type { Metadata } from "next"
import Link from "next/link"

const databaseSteps = [
  {
    title: "1. Provision a Neon PostgreSQL database",
    details: [
      "Create a free account at Neon (https://neon.tech) - the recommended PostgreSQL provider for Spec-Driven.",
      "Create a new project and database. Neon provides a serverless PostgreSQL instance with auto-scaling.",
      "Copy your connection string from the Neon dashboard. It should look like: `postgresql://user:password@ep-xxx.region.neon.tech/dbname?sslmode=require`",
      "Enable connection pooling in Neon settings for better performance with serverless deployments.",
    ],
  },
  {
    title: "2. Configure environment variables",
    details: [
      "Copy `.env.example` to `.env.local` in your project root.",
      "Set `DATABASE_URL` to your Neon connection string with `?sslmode=require&channel_binding=require` for secure connections.",
      "Set `GEMINI_API_KEY` with your Google AI API key for LLM functionality.",
      "Set `BETTER_AUTH_SECRET` to a secure random string (min 32 chars). Generate with: `node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"`",
      "Set `NEXT_PUBLIC_APP_URL` to `http://localhost:3000` for local development.",
    ],
  },
  {
    title: "3. Apply Drizzle migrations",
    details: [
      "Install dependencies first with `npm install`.",
      "Run `npm run db:migrate` to apply all committed migrations to your Neon database.",
      "For rapid iteration during development, use `npm run db:push` to push schema changes directly.",
      "Run `npm run db:generate` to generate new migration files when you modify the schema.",
    ],
  },
  {
    title: "4. Seed reference data (optional)",
    details: [
      "Run `npm run db:seed` to populate initial data if needed.",
      "The seed script is located at `drizzle/seed.ts` and handles duplicate prevention automatically.",
      "You can also run `npm run db:setup` to run both migrations and seeding in one command.",
    ],
  },
  {
    title: "5. Validate the connection",
    details: [
      "Start the development server with `npm run dev`.",
      "Visit `http://localhost:3000` and create an account to verify authentication works.",
      "Create a new project to confirm database reads/writes succeed.",
      "Use `npm run db:studio` to open Drizzle Studio and inspect your database tables directly.",
    ],
  },
]

export const metadata: Metadata = {
  title: "Database Setup | Spec-Driven",
  description: "Step-by-step instructions for configuring the Spec-Driven PostgreSQL database with Neon and Drizzle ORM.",
}

export default function DatabaseSetupPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 lg:px-0">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary uppercase tracking-wide">Guides</p>
        <h1 className="text-3xl font-semibold text-foreground">Database Setup</h1>
        <p className="text-muted-foreground">
          Follow the steps below to provision Neon PostgreSQL, configure Drizzle ORM, and set up the Spec-Driven 
          database schema.
        </p>
      </div>

      <div className="mt-10 space-y-8">
        {databaseSteps.map((step) => (
          <section key={step.title} className="rounded-lg border border-border/60 bg-card/60 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground">{step.title}</h2>
            <ul className="mt-4 list-disc space-y-3 pl-5 text-sm text-muted-foreground">
              {step.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-lg border border-border/60 bg-muted/40 p-6 text-sm text-muted-foreground">
        <p>
          Need help with Drizzle ORM or environment configuration? Reach out to{" "}
          <Link href="mailto:hello@specdriven.ai" className="font-medium text-primary underline">
            hello@specdriven.ai
          </Link>{" "}
          and we&rsquo;ll help get you unblocked.
        </p>
      </div>
    </div>
  )
}
