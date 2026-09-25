import './ai-scalper-bots.scss';

const SCALPER_BOTS = [
    {
        name: 'Over 1 / Under 8 Scalper',
        description: 'Digit contracts targeting over 1 and under 8 outcomes.',
        icon: '◒',
        accent: 'mint',
    },
    {
        name: 'Over 2 / Under 7 Scalper',
        description: 'Digit contracts targeting over 2 and under 7 outcomes.',
        icon: '◓',
        accent: 'blue',
    },
    {
        name: 'Over 3 / Under 6 Scalper',
        description: 'Digit contracts targeting over 3 and under 6 outcomes.',
        icon: '◑',
        accent: 'violet',
    },
    {
        name: 'Over 4 / Under 5 Scalper',
        description: 'Digit contracts targeting over 4 and under 5 outcomes.',
        icon: '◐',
        accent: 'gold',
    },
    {
        name: 'Even / Odd Scalper',
        description: 'Digit contracts comparing even and odd outcomes.',
        icon: '⊕',
        accent: 'coral',
    },
    {
        name: 'Matches Scalper',
        description: 'Digit contracts targeting matching last-digit outcomes.',
        icon: '◎',
        accent: 'teal',
    },
] as const;

const AIScalperBots = () => (
    <main className='ai-scalper-bots'>
        <header className='ai-scalper-bots__header'>
            <div>
                <span className='ai-scalper-bots__eyebrow'>AI trading suite</span>
                <h1 className='ai-scalper-bots__title'>AI Scalper Bots</h1>
                <p className='ai-scalper-bots__subtitle'>
                    Choose a scalper strategy to get started. Bot controls and strategy configuration will be added next.
                </p>
            </div>
            <div className='ai-scalper-bots__badge' aria-label='Six scalper bots'>
                <strong>{SCALPER_BOTS.length}</strong>
                <span>strategies</span>
            </div>
        </header>

        <section className='ai-scalper-bots__grid' aria-label='AI scalper bot strategies'>
            {SCALPER_BOTS.map((bot, index) => (
                <article className={`ai-scalper-bots__card ai-scalper-bots__card--${bot.accent}`} key={bot.name}>
                    <div className='ai-scalper-bots__card-top'>
                        <span className='ai-scalper-bots__icon' aria-hidden='true'>{bot.icon}</span>
                        <span className='ai-scalper-bots__number'>{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <h2>{bot.name}</h2>
                    <p>{bot.description}</p>
                    <span className='ai-scalper-bots__status'>Ready to configure</span>
                </article>
            ))}
        </section>
    </main>
);

export default AIScalperBots;