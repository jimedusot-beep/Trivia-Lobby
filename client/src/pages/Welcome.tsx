import { Link } from "wouter";
import { ArrowRight, BookOpen, Gamepad2, GraduationCap, LockKeyhole, PencilLine, Sparkles, Users, Smartphone } from "lucide-react";
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
          <span className="lobby-kicker">✿ Sakura Arcade · Good times. Great guesses.</span>
          <h1 id="welcome-title">Play together. <span>Learn for fun.</span></h1>
          <p className="home-intro">Your own springtime arcade. Choose a game, scan a code, and bring everyone together—no downloads or guest accounts.</p>
          <nav className="sakura-console" aria-label="Arcade main menu">
            <div className="sakura-console-heading"><span>✿ CHOOSE YOUR ADVENTURE</span><span className="sakura-console-light" aria-hidden="true" /></div>
            <div className="sakura-console-grid">
              <a className="sakura-console-tile sakura-console-play" href="/party/"><Gamepad2 size={30} aria-hidden="true" /><span><strong>PLAY GAMES</strong><small>Start a Party</small></span><ArrowRight size={19} aria-hidden="true" /></a>
              <a className="sakura-console-tile sakura-console-join" href="/party/#join-entry"><Smartphone size={30} aria-hidden="true" /><span><strong>JOIN PARTY</strong><small>Enter a room code</small></span><ArrowRight size={19} aria-hidden="true" /></a>
              <a className="sakura-console-tile sakura-console-create" href="/party/create.html"><PencilLine size={30} aria-hidden="true" /><span><strong>CREATE</strong><small>Make a Quiz</small></span><ArrowRight size={19} aria-hidden="true" /></a>
              <a className="sakura-console-tile sakura-console-learn" href="/party/learn.html"><BookOpen size={30} aria-hidden="true" /><span><strong>LEARN</strong><small>My Courses</small></span><ArrowRight size={19} aria-hidden="true" /></a>
            </div>
            <div className="sakura-prompt-strip" aria-hidden="true"><span><b className="sakura-button-glyph">A</b> Select</span><span><b className="sakura-button-glyph">B</b> Back</span><span><b className="sakura-button-glyph">▸</b> Start</span></div>
          </nav>
          <p className="home-guest-note"><span aria-hidden="true">✓</span> No email. No password. Just jump in. <Link href="/learn-demo">Try a Lesson</Link></p>
        </div>
        <LobbyPartyScene />
      </section>
      <div className="home-marquee" role="group" aria-label="Ways to play"><span>SAKURA ARCADE</span><i aria-hidden="true">✿</i><span>QUIZ</span><i aria-hidden="true">✦</i><span>PROMPT DUEL</span><i aria-hidden="true">✦</i><span>CHARADES</span><i aria-hidden="true">✦</i><span>YOUR OWN IDEAS</span></div>
      <section className="home-play-section" aria-labelledby="pick-your-play">
        <div className="home-section-heading"><div><span className="home-eyebrow">THERE’S A SPOT FOR EVERYONE</span><h2 id="pick-your-play">Pick your kind of good time.</h2></div><span className="home-doodle" aria-hidden="true">↙</span></div>
        <div className="home-play-grid">
          <article className="home-play-card home-card-coral">
            <div className="home-card-top"><span className="home-card-icon"><Users size={30} aria-hidden="true" /></span><span className="home-card-tag">THE WHOLE CREW</span></div>
            <h3>Bring the room to life.</h3><p>Quick guesses, big laughs, and a six-character code that gets everyone in. Try a team showdown, a drawing race, color cards, or a classic board game.</p>
            <a className="home-card-action" href="/party/">Play as a guest <ArrowRight size={19} aria-hidden="true" /></a><span className="home-card-foot">2–20 players · nicknames welcome</span>
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
