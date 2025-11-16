import type { Metadata } from "next"
import Link from "next/link"

const databaseSteps = [
  {
    title: "1. Provision a PostgreSQL database",
    details: [
      "Use any managed PostgreSQL provider (Neon, Supabase, RDS) or a local Postgres 15+ instance.",
      "Create a new database named `spec_driven` (or another name you prefer) and record its connection string.",
      "For Neon, enable pooled connections and copy the pooled connection URL for better performance.",
    ],
  },
  {
    title: "2. Configure environment variables",
    details: [
      "Duplicate `.env.example` to `.env.local` if you have not already.",
      "Set the `DATABASE_URL` variable to your Postgres connection string. Include the `?pgbouncer=true&connect_timeout=15` query params if you are using a pooled connection.",
      "Add other secrets such as `GEMINI_API_KEY` and `NEXTAUTH_SECRET` before running migrations.",
    ],
  },
  {
    title: "3. Apply Prisma migrations",
    details: [
      "Install dependencies first with `npm install`.",
      "Run `npx prisma migrate deploy` to apply the committed migrations to your target database.",
      "If you are iterating locally, you can also use `npx prisma migrate dev` to create new migrations as needed.",
    ],
  },
  {
    title: "4. Seed reference data (optional)",
    details: [
      "To insert the sample workflow records described in the documentation, run `npm run db:seed`.",
      "The seed script lives in `prisma/seed.ts` and is safe to rerun - duplicate entries are skipped.",
    ],
  },
  {
    title: "5. Validate the connection",
    details: [
      "Start the development server with `npm run dev`.",
      "Visit `http://localhost:3001` and create a project to confirm reads/writes succeed.",
      "Use `npx prisma studio` if you want to inspect the database tables directly.",
    ],
  },
]

export const metadata: Metadata = {
  title: "Database Setup | Spec-Driven",
  description: "Step-by-step instructions for configuring the Spec-Driven PostgreSQL database.",
}

export default function DatabaseSetupPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 lg:px-0">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary uppercase tracking-wide">Guides</p>
        <h1 className="text-3xl font-semibold text-foreground">Database Setup</h1>
        <p className="text-muted-foreground">
          Follow the steps below to provision PostgreSQL, configure Prisma, and seed the Spec-Driven data model without
          leaving the platform.
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
          Need a refresher on Prisma models or environment variables? Reach out to{" "}
          <Link href="mailto:hello@specdriven.ai" className="font-medium text-primary underline">
            hello@specdriven.ai
          </Link>{" "}
          and we&rsquo;ll help get you unblocked.
        </p>
      </div>
    </div>
  )
}
