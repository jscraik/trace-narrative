import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import claudeIcon from '../../assets/icons/claude-color.svg';
import geminiIcon from '../../assets/icons/gemini-color.svg';
import kimiIcon from '../../assets/icons/kimi-color.svg';
import ollamaIcon from '../../assets/icons/ollama.svg';
import openaiIcon from '../../assets/icons/openai.svg';
import './FireflyLanding.css';
import { FireflyHero } from '../components/FireflyHero';

export function FireflyLanding(props: { onGetStarted?: () => void }) {
    const { onGetStarted } = props;
    const [isExiting, setIsExiting] = useState(false);
    const partnerAgents: {
        name: string;
        icon: string;
        invertLogo?: boolean;
        currentColorLogo?: boolean;
    }[] = [
        {
            name: 'OpenAI Codex CLI',
            icon: openaiIcon,
            currentColorLogo: true,
        },
        {
            name: 'Claude Code',
            icon: claudeIcon,
        },
        {
            name: 'Gemini CLI',
            icon: geminiIcon,
        },
        {
            name: 'Kimi CLI',
            icon: kimiIcon,
        },
        {
            name: 'Ollama',
            icon: ollamaIcon,
            currentColorLogo: true,
        },
    ];

    const handleGetStarted = () => {
        if (isExiting) return;
        setIsExiting(true);
    };

    return (
        <div className="landing-landing">
            {/* Background Dots */}
            <div className="landing-dot-grid" aria-hidden="true" />

            {/* Main Content */}
            <main className="landing-main">
                {/* FireflyHero — absolute layer, sits visually behind the h1 */}
                <div className="landing-hero-orb-layer" aria-hidden="true">
                    <FireflyHero isExiting={isExiting} onExitComplete={onGetStarted} />
                </div>

                <section className="landing-hero-content animate-fade-in-up relative">
                    <div className="landing-hero-copy-shell">
                        <h1 className="landing-title">
                            <span className="brand-firefly landing-title-brand">Firefly</span>
                            <span>Narrative</span>
                        </h1>

                        <div className="landing-copy-block">
                            <p id="landing-tagline" className="landing-subtitle animate-fade-in-up delay-200">
                                <span className="landing-subtitle-line">Capture the ghost in the machine, discover the narrative.</span>
                                <span className="landing-subtitle-line">A living trace of your intent, woven into every commit.</span>
                            </p>

                            <div className="landing-cta-wrap animate-fade-in-up delay-300">
                                <button
                                    type="button"
                                    id="cta-get-started"
                                    onClick={handleGetStarted}
                                    disabled={isExiting}
                                    aria-busy={isExiting || undefined}
                                    aria-label="Get started with Firefly Narrative"
                                    aria-describedby="landing-tagline"
                                    className="landing-cta"
                                >
                                    Get Started <ArrowRight className="w-5 h-5" aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer / Logos Section */}
            <footer className="landing-footer animate-fade-in-up delay-500">
                <div className="landing-footer-inner">
                    <h2 className="landing-footer-heading">
                        Works with your favorite agents
                    </h2>

                    <ul className="landing-brand-list">
                        {partnerAgents.map((agent, index) => {
                            const floatDelay = `${100 + index * 100}ms`;
                            const logoClass = `landing-brand-chip-logo${agent.invertLogo ? ' landing-brand-chip-logo--invert' : ''}${agent.currentColorLogo ? ' landing-brand-chip-logo--current-color' : ''}`;

                            return (
                                <li
                                    key={agent.name}
                                    className="landing-brand-chip animate-float"
                                    style={{ animationDelay: floatDelay }}
                                >
                                    <img
                                        src={agent.icon}
                                        alt={agent.name}
                                        width={20}
                                        height={20}
                                        loading="eager"
                                        className={logoClass}
                                    />
                                    <span>{agent.name}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </footer>
        </div>
    );
}
