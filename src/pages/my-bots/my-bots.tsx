import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { DBOT_TABS } from '@/constants/bot-contents';
import BlockConversion from '@/external/bot-skeleton/scratch/backward-compatibility';
import { loadWorkspace } from '@/external/bot-skeleton/scratch/utils';
import { useStore } from '@/hooks/useStore';
import entryBotXml from '../../../attached_assets/ENTRY_BOT_1790341956591.xml';
import firstEntryPointXml from '../../../attached_assets/FIRST_ENTRY_POINT_pick_1790341980021.xml';
import martingaleBotXml from '../../../attached_assets/MARTINGALE_BOT_1790341875205.xml';
import './my-bots.scss';

type TMyBot = {
    id: string;
    name: string;
    description: string;
    icon: string;
    xml: string;
};

const MY_BOTS: TMyBot[] = [
    {
        id: 'martingale',
        name: 'Martingale Bot',
        description: 'Your saved martingale strategy, ready to review and edit in Bot Builder.',
        icon: '↗',
        xml: martingaleBotXml,
    },
    {
        id: 'entry',
        name: 'Entry Bot',
        description: 'Your saved entry strategy, ready to review and edit in Bot Builder.',
        icon: '◈',
        xml: entryBotXml,
    },
    {
        id: 'first-entry-point',
        name: 'First Entry Point Pick',
        description: 'Your saved first-entry-point strategy, ready to review and edit in Bot Builder.',
        icon: '◎',
        xml: firstEntryPointXml,
    },
];

const MyBots = observer(() => {
    const { dashboard, save_modal } = useStore();
    const [loading_id, setLoadingId] = useState<string | null>(null);
    const [loaded_id, setLoadedId] = useState<string | null>(null);
    const [load_error, setLoadError] = useState<string | null>(null);

    const loadBot = async (bot: TMyBot) => {
        if (loading_id) return;

        setLoadingId(bot.id);
        setLoadedId(null);
        setLoadError(null);

        try {
            const B = (window as any).Blockly;
            let workspace = B?.derivWorkspace;

            for (let attempt = 0; !workspace && attempt < 40; attempt++) {
                await new Promise(resolve => window.setTimeout(resolve, 100));
                workspace = B?.derivWorkspace;
            }

            if (!workspace || !B?.Xml) {
                throw new Error('Bot Builder workspace did not finish loading. Please try again.');
            }

            const dom = new BlockConversion().convertStrategy(B.utils.xml.textToDom(bot.xml), false);
            const unsupported_blocks = Array.from(dom.querySelectorAll('block, shadow'))
                .map((block: Element) => block.getAttribute('type'))
                .filter((type: string | null) => type && !B.Blocks[type]);

            if (unsupported_blocks.length) {
                throw new Error(`Unsupported block types: ${[...new Set(unsupported_blocks)].join(', ')}`);
            }

            const event_group = `my-bot-load-${Date.now()}`;
            try {
                await loadWorkspace(dom, event_group, workspace);
            } finally {
                B.Events.setGroup(false);
            }

            if (!workspace.getTopBlocks(false).length) {
                throw new Error('This bot loaded without any blocks.');
            }

            workspace.clearUndo();
            workspace.current_strategy_id = B.utils.idGenerator.genUid();
            workspace.strategy_to_load = B.Xml.domToText(dom);
            save_modal.updateBotName(bot.name);
            setLoadedId(bot.id);
            dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
            window.setTimeout(() => save_modal.updateBotName(bot.name), 0);
        } catch (error) {
            setLoadError(`Could not load ${bot.name}: ${(error as Error).message || 'Please try again.'}`);
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <main className='my-bots'>
            <header className='my-bots__header'>
                <div>
                    <span className='my-bots__eyebrow'>YOUR STRATEGIES</span>
                    <h1 className='my-bots__title'>My Bots</h1>
                    <p className='my-bots__subtitle'>
                        Choose a saved bot to load its blocks into Bot Builder. Loading a bot will not start it.
                    </p>
                </div>
                <span className='my-bots__count' aria-label={`${MY_BOTS.length} saved bots`}>
                    <strong>{MY_BOTS.length}</strong>
                    <span>bots</span>
                </span>
            </header>

            <p className='my-bots__notice'>
                Review the strategy and stake settings in Bot Builder before pressing Run.
            </p>

            {load_error && (
                <p className='my-bots__error' role='alert'>
                    {load_error}
                </p>
            )}

            <section className='my-bots__grid' aria-label='Your saved bots'>
                {MY_BOTS.map((bot, index) => {
                    const is_loading = loading_id === bot.id;
                    const is_loaded = loaded_id === bot.id;

                    return (
                        <article
                            className={`my-bots__card${is_loaded ? ' my-bots__card--loaded' : ''}`}
                            key={bot.id}
                        >
                            <div className='my-bots__card-top'>
                                <span className='my-bots__icon' aria-hidden='true'>{bot.icon}</span>
                                <span className='my-bots__number'>{String(index + 1).padStart(2, '0')}</span>
                            </div>
                            <h2 className='my-bots__card-title'>{bot.name}</h2>
                            <p className='my-bots__card-description'>{bot.description}</p>
                            <button
                                className='my-bots__load-button'
                                type='button'
                                disabled={loading_id !== null}
                                aria-busy={is_loading}
                                onClick={() => void loadBot(bot)}
                            >
                                {is_loading ? 'Loading…' : is_loaded ? 'Loaded in Bot Builder' : 'Load in Bot Builder'}
                            </button>
                        </article>
                    );
                })}
            </section>
        </main>
    );
});

export default MyBots;