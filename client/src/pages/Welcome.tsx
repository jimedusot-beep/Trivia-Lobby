import { Link } from "wouter";
import { ArrowRight, BookOpen, Gamepad2, GraduationCap, LockKeyhole, PencilLine, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LobbyBrand, LobbyPartyScene } from "@/components/LobbyIdentity";
import "./Welcome.css";

/** Public clubhouse. Every primary action works without an account. */
export default function Welcome() {
  return <main className="lobby-home">
    <div className="home-shell">
      <nav className="home-nav" aria-label="Main navigation">
        <LobbyBrand />
        <div className="home-nav-links">
          <a href="/party/">Party games</a><a href="/party/learn.html">My courses</a><a href="/party/create.html">Make a quiz</a>
          <Link href="/decks" className="private-link"><LockKeyhole size={15} aria-hidden="true" /> Private library</Link>
        </div>
      </nav>
      <section className="home-hero" aria-labelledby="welcome-title">
        <div className="home-hero-copy">
          <span className="lobby-kicker">Good times. Great guesses.</span>
          <h1 id="welcome-title">Play together. <span>Learn for fun.</span></h1>
          <p className="home-intro">A little friendly competition. A lot of “one more round.” Turn your questions into a party, or make a small learning win all your own.</p>
          <div className="home-hero-actions">
            <Button asChild size="lg" className="home-cta home-cta-primary"><a href="/party/"><Gamepad2 aria-hidden="true" /> Start a Party <ArrowRight aria-hidden="true" /></a></Button>
            <Button asChild size="lg" variant="secondary" className="home-cta home-cta-coral"><Link href="/learn-demo"><GraduationCap aria-hidden="true" /> Try a Lesson</Link></Button>
            <Button asChild size="lg" variant="outline" className="home-cta home-cta-gold"><a href="/party/create.html"><PencilLine aria-hidden="true" /> Make a Quiz</a></Button>
          </div>
          <p className="home-guest-note"><span aria-hidden="true">✓</span> No email. No password. Just jump in.</p>
        </div>
        <LobbyPartyScene />
      </section>
      <div className="home-marquee" aria-label="Ways to play"><span>QUIZ</span><i aria-hidden="true">✦</i><span>PROMPT DUEL</span><i aria-hidden="true">✦</i><span>CHARADES</span><i aria-hidden="true">✦</i><span>YOUR OWN IDEAS</span></div>
      <section className="home-play-section" aria-labelledby="pick-your-play">
        <div className="home-section-heading"><div><span className="home-eyebrow">THERE’S A SPOT FOR EVERYONE</span><h2 id="pick-your-play">Pick your kind of good time.</h2></div><span className="home-doodle" aria-hidden="true">↙</span></div>
        <div className="home-play-grid">
          <article className="home-play-card home-card-coral">
            <div className="home-card-top"><span className="home-card-icon"><Users size={30} aria-hidden="true" /></span><span className="home-card-tag">THE WHOLE CREW</span></div>
            <h3>Bring the room to life.</h3><p>Quick guesses, big laughs, and a six-character code that gets everyone in. Quiz, Prompt Duel, or Charades?</p>
            <a className="home-card-action" href="/party/">Play as a guest <ArrowRight size={19} aria-hidden="true" /></a><span className="home-card-foot">3–8 players · nicknames welcome</span>
          </article>
          <article className="home-play-card home-card-sky">
            <div className="home-card-top"><span className="home-card-icon"><BookOpen size={30} aria-hidden="true" /></span><span className="home-card-tag">YOUR LITTLE WIN</span></div>
            <h3>A little smarter. A little happier.</h3><p>Turn your quizzes into bite-sized courses. Follow your path, collect achievements, and learn at your own pace.</p>
            <a className="home-card-action" href="/party/learn.html">Learn from my quizzes <ArrowRight size={19} aria-hidden="true" /></a><Link href="/learn-demo" className="home-card-foot home-text-link">Or start sample lessons</Link>
          </article>
          <article className="home-play-card home-card-gold">
            <div className="home-card-top"><span className="home-card-icon"><PencilLine size={30} aria-hidden="true" /></span><span className="home-card-tag">THE IDEA MAKER</span></div>
            <h3>Your questions. Your rules.</h3><p>Inside jokes? Science facts? Family lore? Make your own quiz, import questions, then practice or host your creation.</p>
            <a className="home-card-action" href="/party/create.html">Make it your own <ArrowRight size={19} aria-hidden="true" /></a><span className="home-card-foot">Create · save · play · repeat</span>
          </article>
        </div>
      </section>
      <section className="home-house-rules" aria-label="Good to know">
        <img src="/party/lobby-spark.svg" className="lobby-hello" width="88" height="88" alt="" />
        <div><span className="home-eyebrow">A FEW HOUSE RULES</span><h2>More fun. Less fuss.</h2><p>Guest quizzes and learning progress stay in this browser. Download a backup to keep them. Party rooms are temporary, so keep the good times in the same session.</p></div><span className="home-rule-stamp" aria-hidden="true">ALL PLAY.<br />NO PRESSURE.</span>
      </section>
      <footer className="home-footer"><p><Sparkles size={16} aria-hidden="true" /> Made for your kind of game night.</p><Link href="/decks"><LockKeyhole size={15} aria-hidden="true" /> Open your protected private library <ArrowRight size={15} aria-hidden="true" /></Link></footer>
    </div>
  </main>;
}
