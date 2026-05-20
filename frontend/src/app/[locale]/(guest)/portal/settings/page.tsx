'use client';

export default function SettingsPage() {
  return (
    <main className="w-full bg-[#020617] px-4 py-8 font-sans text-white sm:px-6 lg:px-10">
      <section className="mx-auto max-w-6xl rounded-3xl bg-[#0F172A] p-8 shadow-2xl shadow-slate-950/30 sm:p-10 lg:p-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(420px,1.45fr)] lg:items-start">
          <div className="max-w-sm">
            <h2 className="text-xl font-bold tracking-normal text-white">
              Log out other sessions
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#9CA3AF]">
              Please enter your password to confirm you would like to log out of
              your other sessions across all of your devices.
            </p>
          </div>

          <form className="w-full">
            <label
              htmlFor="logout-password"
              className="block text-sm font-bold text-white"
            >
              Your password
            </label>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row">
              <input
                id="logout-password"
                type="password"
                className="h-12 min-w-0 flex-1 rounded-xl border border-slate-700 bg-[#111827] px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#A78BFA] focus:ring-2 focus:ring-[#A78BFA]/30"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="h-12 rounded-full bg-[#A78BFA] px-6 text-sm font-bold text-white transition hover:bg-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#A78BFA]/60 focus:ring-offset-2 focus:ring-offset-[#0F172A]"
              >
                Log out other sessions
              </button>
            </div>
          </form>
        </div>

        <div className="my-12 h-px w-full bg-slate-700/70" />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(420px,1.45fr)] lg:items-start">
          <div className="max-w-sm">
            <h2 className="text-xl font-bold tracking-normal text-white">
              Delete account
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#9CA3AF]">
              No longer want to use our service? You can delete your account
              here. This action is not reversible. All information related to
              this account will be deleted permanently.
            </p>
          </div>

          <div className="flex justify-start lg:justify-end">
            <button
              type="button"
              className="h-12 rounded-full bg-[#EF4444] px-7 text-sm font-bold text-white transition hover:bg-[#DC2626] focus:outline-none focus:ring-2 focus:ring-[#EF4444]/60 focus:ring-offset-2 focus:ring-offset-[#0F172A]"
            >
              Yes, delete my account
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
