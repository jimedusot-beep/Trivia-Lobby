import { useEffect } from "react";
import { useDisplayLanguage } from "@/lib/use-display-language";
import { t } from "../../../examples/party-engine/public/i18n.js";
import { Link } from "wouter";
import { ArrowRight, BookOpen, Gamepad2, GraduationCap, LockKeyhole, PencilLine, Sparkles, Users, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LobbyBrand, LobbyPartyScene } from "@/components/LobbyIdentity";
import "./Welcome.css";

/** Public clubhouse. Every primary action works without an account. */
export default function Welcome() {
  const language = useDisplayLanguage();
  useEffect(() => { document.title = t("Trivia Lobby — Play Together, Learn Together"); const meta = document.querySelector('meta[name="description"]'); meta?.setAttribute("content", t("Play family trivia games and build reusable college study flashcards.")); }, [language]);
  return <main className="lobby-home" lang={language}>
    <div className="home-shell">
      <nav className="home-nav" aria-label={t("Main navigation")}>
        <LobbyBrand />
        <div className="home-nav-links">
          <a href="/party/">{t("Party games")}</a><a href="/party/learn.html">{t("My courses")}</a><a href="/party/create.html">{t("Make a quiz")}</a>
          <Link href="/decks" className="private-link"><LockKeyhole size={15} aria-hidden="true" />{" "}{t("Private library")}</Link>
        </div>
      </nav>
      <section className="home-hero" aria-labelledby="welcome-title">
        <div className="home-hero-copy">
          <p className="bilingual-identity-line">{t("Two languages. One party.")}</p>
          <span className="lobby-kicker">{t("✿ Sakura Arcade · Good times. Great guesses.")}</span>
          <h1 id="welcome-title">{t("Play together.")}{" "}<span>{t("Learn for fun.")}</span></h1>
          <p className="home-intro">{t("Your own springtime arcade. Choose a game, scan a code, and bring everyone together—no downloads or guest accounts.")}</p>
          <nav className="sakura-console" aria-label={t("Arcade main menu")}>
            <div className="sakura-console-heading"><span>{t("✿ CHOOSE YOUR ADVENTURE")}</span><span className="sakura-console-light" aria-hidden="true" /></div>
            <div className="sakura-console-grid">
              <a className="sakura-console-tile sakura-console-play" href="/party/"><Gamepad2 size={30} aria-hidden="true" /><span><strong>{t("PLAY GAMES")}</strong><small>{t("Start a Party")}</small></span><ArrowRight size={19} aria-hidden="true" /></a>
              <a className="sakura-console-tile sakura-console-join" href="/party/#join-entry"><Smartphone size={30} aria-hidden="true" /><span><strong>{t("JOIN PARTY")}</strong><small>{t("Enter a room code")}</small></span><ArrowRight size={19} aria-hidden="true" /></a>
              <a className="sakura-console-tile sakura-console-create" href="/party/create.html"><PencilLine size={30} aria-hidden="true" /><span><strong>{t("CREATE")}</strong><small>{t("Make a Quiz")}</small></span><ArrowRight size={19} aria-hidden="true" /></a>
              <a className="sakura-console-tile sakura-console-learn" href="/party/learn.html"><BookOpen size={30} aria-hidden="true" /><span><strong>{t("LEARN")}</strong><small>{t("My Courses")}</small></span><ArrowRight size={19} aria-hidden="true" /></a>
            </div>
            <div className="sakura-prompt-strip" aria-hidden="true"><span><b className="sakura-button-glyph">A</b>{" "}{t("Select")}</span><span><b className="sakura-button-glyph">B</b>{" "}{t("Back")}</span><span><b className="sakura-button-glyph">▸</b>{" "}{t("Start")}</span></div>
          </nav>
          <p className="home-guest-note"><span aria-hidden="true">✓</span>{" "}{t("No email. No password. Just jump in.")}{" "}<Link href="/learn-demo">{t("Try a Lesson")}</Link></p>
        </div>
        <LobbyPartyScene />
      </section>
      <div className="home-marquee" role="group" aria-label={t("Ways to play")}><span>SAKURA ARCADE</span><i aria-hidden="true">✿</i><span>{t("QUIZ")}</span><i aria-hidden="true">✦</i><span>{t("PROMPT DUEL")}</span><i aria-hidden="true">✦</i><span>{t("CHARADES")}</span><i aria-hidden="true">✦</i><span>{t("YOUR OWN IDEAS")}</span></div>
      <section className="home-play-section" aria-labelledby="pick-your-play">
        <div className="home-section-heading"><div><span className="home-eyebrow">{t("THERE’S A SPOT FOR EVERYONE")}</span><h2 id="pick-your-play">{t("Pick your kind of good time.")}</h2></div><span className="home-doodle" aria-hidden="true">↙</span></div>
        <div className="home-play-grid">
          <article className="home-play-card home-card-coral">
            <div className="home-card-top"><span className="home-card-icon"><Users size={30} aria-hidden="true" /></span><span className="home-card-tag">{t("THE WHOLE CREW")}</span></div>
            <h3>{t("Bring the room to life.")}</h3><p>{t("Quick guesses, big laughs, and a six-character code that gets everyone in. Try a team showdown, a drawing race, color cards, or a classic board game.")}</p>
            <a className="home-card-action" href="/party/">{t("Play as a guest")}{" "}<ArrowRight size={19} aria-hidden="true" /></a><span className="home-card-foot">{t("2–20 players · nicknames welcome")}</span>
          </article>
          <article className="home-play-card home-card-sky">
            <div className="home-card-top"><span className="home-card-icon"><BookOpen size={30} aria-hidden="true" /></span><span className="home-card-tag">{t("YOUR LITTLE WIN")}</span></div>
            <h3>{t("A little smarter. A little happier.")}</h3><p>{t("Turn your quizzes into bite-sized courses. Follow your path, collect achievements, and learn at your own pace.")}</p>
            <a className="home-card-action" href="/party/learn.html">{t("Learn from my quizzes")}{" "}<ArrowRight size={19} aria-hidden="true" /></a><Link href="/learn-demo" className="home-card-foot home-text-link">{t("Or start sample lessons")}</Link>
          </article>
          <article className="home-play-card home-card-gold">
            <div className="home-card-top"><span className="home-card-icon"><PencilLine size={30} aria-hidden="true" /></span><span className="home-card-tag">{t("THE IDEA MAKER")}</span></div>
            <h3>{t("Your questions. Your rules.")}</h3><p>{t("Inside jokes? Science facts? Family lore? Make your own quiz, import questions, then practice or host your creation.")}</p>
            <a className="home-card-action" href="/party/create.html">{t("Make it your own")}{" "}<ArrowRight size={19} aria-hidden="true" /></a><span className="home-card-foot">{t("Create · save · play · repeat")}</span>
          </article>
        </div>
      </section>
      <section className="home-house-rules" aria-label={t("Good to know")}>
        <img src="/party/lobby-spark.svg" className="lobby-hello" width="88" height="88" alt="" />
        <div><span className="home-eyebrow">{t("A FEW HOUSE RULES")}</span><h2>{t("More fun. Less fuss.")}</h2><p>{t("Guest quizzes and learning progress stay in this browser. Download a backup to keep them. Party rooms are temporary, so keep the good times in the same session.")}</p></div><span className="home-rule-stamp" aria-hidden="true">{t("ALL PLAY.")}<br />{t("NO PRESSURE.")}</span>
      </section>
      <footer className="home-footer"><p><Sparkles size={16} aria-hidden="true" />{" "}{t("Made for your kind of game night.")}</p><Link href="/decks"><LockKeyhole size={15} aria-hidden="true" />{" "}{t("Open your protected private library")}{" "}<ArrowRight size={15} aria-hidden="true" /></Link></footer>
    </div>
  </main>;
}
