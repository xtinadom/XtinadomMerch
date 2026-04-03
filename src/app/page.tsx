import Link from "next/link";
import { choosePersonaForm } from "@/actions/persona";

export default function WelcomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-rose-400/80">
          Xtinadom
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Welcome
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Choose how you shop. You can browse every category from the menu anytime
          — this just sets your starting view.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <form action={choosePersonaForm}>
            <input type="hidden" name="persona" value="sub" />
            <button
              type="submit"
              className="w-full rounded-xl border border-rose-900/60 bg-rose-950/40 px-8 py-3 text-sm font-medium text-rose-100 transition hover:bg-rose-900/50 sm:w-auto"
            >
              I&apos;m a sub
            </button>
          </form>
          <form action={choosePersonaForm}>
            <input type="hidden" name="persona" value="domme" />
            <button
              type="submit"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-8 py-3 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 sm:w-auto"
            >
              I&apos;m a domme
            </button>
          </form>
        </div>
        <Link
          href="/shop"
          className="mt-8 inline-block text-xs text-zinc-600 underline-offset-4 hover:text-zinc-400 hover:underline"
        >
          Skip and go to the shop
        </Link>
      </div>
    </main>
  );
}
