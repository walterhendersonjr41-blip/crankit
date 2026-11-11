import { withBase } from "../lib/paths";

export function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-garage-bg text-neutral-100">
      <main className="mx-auto max-w-lg space-y-4 px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="text-[11px] font-bold uppercase tracking-widest text-garage-orange">CrankIt</p>
        <h1 className="text-2xl font-black">Privacy</h1>
        <p className="text-sm leading-relaxed text-neutral-300">
          CrankIt is a driveway mechanic app that runs in your browser. It is built to work offline and to keep your
          garage on this device unless you choose to share a fix.
        </p>
        <section className="space-y-2">
          <h2 className="text-lg font-black">Stored on this device</h2>
          <p className="text-sm leading-relaxed text-neutral-300">
            My Garage tools, fuel batches, diagnostic history, chat, local learning (FIXED IT results, ratings, and
            tips you taught), and a Pro unlock flag stay in this browser’s localStorage. That data is not sent to a
            CrankIt server. Use Reset learning in Ask Mechanic to clear learning, or clear this site’s data in your
            browser to wipe everything stored here.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-black">Opt-in anonymous sharing</h2>
          <p className="text-sm leading-relaxed text-neutral-300">
            The “Share this fix with CrankIt” button is optional. After you see a one-line consent note and confirm,
            your email app opens a prefilled message that includes only: tool type, brand/model if you entered one,
            symptom, fix, whether it worked, app version, and date. The message body does not include your name, phone,
            garage tool nickname, IP address, or a device ID.
          </p>
          <p className="text-sm leading-relaxed text-neutral-300">
            Because this uses your email app, the sender address on that email will be visible to us. You can cancel in
            the email app if you change your mind. We do not ask you to create an account. You can use the app fully
            without sharing. Reviewed fixes may be added to a later app update.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-black">Payments and parts links</h2>
          <p className="text-sm leading-relaxed text-neutral-300">
            If you buy CrankIt Pro, checkout happens on Stripe’s site, not in this app. We do not store card numbers.
            Pro on this device is an honor-system unlock kept in localStorage. Parts links may go to Amazon; an
            affiliate disclosure appears only if an Associates tag is configured.
          </p>
        </section>
        <p>
          <a href={withBase()} className="inline-flex min-h-11 items-center font-bold text-orange-200 underline">
            Back to CrankIt
          </a>
        </p>
      </main>
    </div>
  );
}
