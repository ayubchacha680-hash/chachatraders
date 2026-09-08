// @ts-nocheck
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { DBOT_TABS } from '@/constants/bot-contents';
import BlockConversion from '@/external/bot-skeleton/scratch/backward-compatibility';
import { loadWorkspace } from '@/external/bot-skeleton/scratch/utils';
import { useStore } from '@/hooks/useStore';
import {
    chachaOverCycleXml,
    marketCycleBotXml,
    over2KillerXml,
    TCycleBotSettings,
    TKillerSettings,
} from './strategies/cycle-bots';
import { validateCycleSettings, validateKillerSettings } from './strategies/strategy-helpers';
import './free-bots.scss';

/* ── XML generators ──────────────────────────────────────────────────────── */

const riseFallXML = (p: {
    symbol: string; market: string; submarket: string;
    type: 'CALL' | 'PUT'; stake: number; mult: number;
}) => `<xml xmlns="http://www.w3.org/1999/xhtml" collection="false" is_dbot="true">
  <variables>
    <variable type="" id="mg_size" islocal="false" iscloud="false">martingale:size</variable>
    <variable type="" id="mg_mult" islocal="false" iscloud="false">martingale:multiplier</variable>
    <variable type="" id="mg_init" islocal="false" iscloud="false">martingale:initialStake</variable>
  </variables>
  <block type="trade_definition" id="td1" x="0" y="0">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="mkt1" deletable="false" movable="false">
        <field name="MARKET_LIST">${p.market}</field>
        <field name="SUBMARKET_LIST">${p.submarket}</field>
        <field name="SYMBOL_LIST">${p.symbol}</field>
        <next>
          <block type="trade_definition_tradetype" id="tt1" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">callput</field>
            <field name="TRADETYPE_LIST">callput</field>
            <next>
              <block type="trade_definition_contracttype" id="ct1" deletable="false" movable="false">
                <field name="TYPE_LIST">${p.type}</field>
                <next>
                  <block type="trade_definition_candleinterval" id="ci1" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="rb1" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="re1" deletable="false" movable="false">
                            <field name="RESTARTONERROR">TRUE</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="INITIALIZATION">
      <block type="variables_set" id="i1">
        <field name="VAR" id="mg_size">martingale:size</field>
        <value name="VALUE"><shadow type="math_number" id="n1"><field name="NUM">${p.stake}</field></shadow></value>
        <next>
          <block type="variables_set" id="i2">
            <field name="VAR" id="mg_mult">martingale:multiplier</field>
            <value name="VALUE"><shadow type="math_number" id="n2"><field name="NUM">${p.mult}</field></shadow></value>
            <next>
              <block type="variables_set" id="i3">
                <field name="VAR" id="mg_init">martingale:initialStake</field>
                <value name="VALUE"><shadow type="math_number" id="n3"><field name="NUM">${p.stake}</field></shadow></value>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions" id="to1">
        <mutation has_first_barrier="false" has_second_barrier="false" has_prediction="false"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <field name="CURRENCY_LIST">USD</field>
        <value name="DURATION"><shadow type="math_number" id="d1"><field name="NUM">5</field></shadow></value>
        <value name="AMOUNT">
          <block type="variables_get" id="ga1"><field name="VAR" id="mg_size">martingale:size</field></block>
        </value>
      </block>
    </statement>
    <statement name="AFTER_PURCHASE">
      <block type="bot_result_is" id="w1">
        <field name="RESULT_LIST">win</field>
        <statement name="STATEMENT">
          <block type="variables_set" id="wr1">
            <field name="VAR" id="mg_size">martingale:size</field>
            <value name="VALUE">
              <block type="variables_get" id="wi1"><field name="VAR" id="mg_init">martingale:initialStake</field></block>
            </value>
          </block>
        </statement>
        <next>
          <block type="bot_result_is" id="l1">
            <field name="RESULT_LIST">loss</field>
            <statement name="STATEMENT">
              <block type="variables_set" id="lr1">
                <field name="VAR" id="mg_size">martingale:size</field>
                <value name="VALUE">
                  <block type="math_arithmetic" id="mul1">
                    <field name="OP">MULTIPLY</field>
                    <value name="A"><block type="variables_get" id="gc1"><field name="VAR" id="mg_size">martingale:size</field></block></value>
                    <value name="B"><block type="variables_get" id="gm1"><field name="VAR" id="mg_mult">martingale:multiplier</field></block></value>
                  </block>
                </value>
              </block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`;

const digitXML = (p: {
    symbol: string; market: string; submarket: string;
    tradetype: string; contracttype: string;
    prediction: number | null; stake: number; mult: number;
}) => `<xml xmlns="http://www.w3.org/1999/xhtml" collection="false" is_dbot="true">
  <variables>
    <variable type="" id="mg_size" islocal="false" iscloud="false">martingale:size</variable>
    <variable type="" id="mg_mult" islocal="false" iscloud="false">martingale:multiplier</variable>
    <variable type="" id="mg_init" islocal="false" iscloud="false">martingale:initialStake</variable>
  </variables>
  <block type="trade_definition" id="td1" x="0" y="0">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="mkt1" deletable="false" movable="false">
        <field name="MARKET_LIST">${p.market}</field>
        <field name="SUBMARKET_LIST">${p.submarket}</field>
        <field name="SYMBOL_LIST">${p.symbol}</field>
        <next>
          <block type="trade_definition_tradetype" id="tt1" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">${p.tradetype}</field>
            <next>
              <block type="trade_definition_contracttype" id="ct1" deletable="false" movable="false">
                <field name="TYPE_LIST">${p.contracttype}</field>
                <next>
                  <block type="trade_definition_candleinterval" id="ci1" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="rb1" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="re1" deletable="false" movable="false">
                            <field name="RESTARTONERROR">TRUE</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="INITIALIZATION">
      <block type="variables_set" id="i1">
        <field name="VAR" id="mg_size">martingale:size</field>
        <value name="VALUE"><shadow type="math_number" id="n1"><field name="NUM">${p.stake}</field></shadow></value>
        <next>
          <block type="variables_set" id="i2">
            <field name="VAR" id="mg_mult">martingale:multiplier</field>
            <value name="VALUE"><shadow type="math_number" id="n2"><field name="NUM">${p.mult}</field></shadow></value>
            <next>
              <block type="variables_set" id="i3">
                <field name="VAR" id="mg_init">martingale:initialStake</field>
                <value name="VALUE"><shadow type="math_number" id="n3"><field name="NUM">${p.stake}</field></shadow></value>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions" id="to1">
        <mutation has_first_barrier="false" has_second_barrier="false" has_prediction="${p.prediction !== null ? 'true' : 'false'}"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <field name="CURRENCY_LIST">USD</field>
        <value name="DURATION"><shadow type="math_number" id="d1"><field name="NUM">5</field></shadow></value>
        <value name="AMOUNT">
          <block type="variables_get" id="ga1"><field name="VAR" id="mg_size">martingale:size</field></block>
        </value>
        ${p.prediction !== null ? `<value name="PREDICTION"><shadow type="math_number" id="pr1"><field name="NUM">${p.prediction}</field></shadow></value>` : ''}
      </block>
    </statement>
    <statement name="AFTER_PURCHASE">
      <block type="bot_result_is" id="w1">
        <field name="RESULT_LIST">win</field>
        <statement name="STATEMENT">
          <block type="variables_set" id="wr1">
            <field name="VAR" id="mg_size">martingale:size</field>
            <value name="VALUE">
              <block type="variables_get" id="wi1"><field name="VAR" id="mg_init">martingale:initialStake</field></block>
            </value>
          </block>
        </statement>
        <next>
          <block type="bot_result_is" id="l1">
            <field name="RESULT_LIST">loss</field>
            <statement name="STATEMENT">
              <block type="variables_set" id="lr1">
                <field name="VAR" id="mg_size">martingale:size</field>
                <value name="VALUE">
                  <block type="math_arithmetic" id="mul1">
                    <field name="OP">MULTIPLY</field>
                    <value name="A"><block type="variables_get" id="gc1"><field name="VAR" id="mg_size">martingale:size</field></block></value>
                    <value name="B"><block type="variables_get" id="gm1"><field name="VAR" id="mg_mult">martingale:multiplier</field></block></value>
                  </block>
                </value>
              </block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`;

/* ── Bot catalogue ───────────────────────────────────────────────────────── */

type TBot = {
    id: string;
    name: string;
    description: string;
    identity: string;
    category: string;
    tag: string;
    winChance: string;
    getXml: (settings?: any) => string;
    configurable?: 'cycle' | 'killer';
};

const BOTS: TBot[] = [
    {
        id: 'rise_r100',
        name: 'Rise Martingale – Vol 100',
        description: 'Buys RISE (CALL) contracts on Volatility 100 Index. Doubles stake on each loss, resets on win. 5-tick duration.',
        identity: 'RISE',
        category: 'Rise / Fall',
        tag: 'Vol 100',
        winChance: '~50%',
        getXml: () => riseFallXML({ symbol: 'R_100', market: 'synthetic_index', submarket: 'random_index', type: 'CALL', stake: 1, mult: 2 }),
    },
    {
        id: 'fall_r100',
        name: 'Fall Martingale – Vol 100',
        description: 'Buys FALL (PUT) contracts on Volatility 100 Index. Doubles stake on each loss, resets on win. 5-tick duration.',
        identity: 'FALL',
        category: 'Rise / Fall',
        tag: 'Vol 100',
        winChance: '~50%',
        getXml: () => riseFallXML({ symbol: 'R_100', market: 'synthetic_index', submarket: 'random_index', type: 'PUT', stake: 1, mult: 2 }),
    },
    {
        id: 'rise_r50',
        name: 'Rise Martingale – Vol 50',
        description: 'Buys RISE contracts on Volatility 50 Index with lower volatility. Martingale ×2 on loss.',
        identity: 'R50',
        category: 'Rise / Fall',
        tag: 'Vol 50',
        winChance: '~50%',
        getXml: () => riseFallXML({ symbol: 'R_50', market: 'synthetic_index', submarket: 'random_index', type: 'CALL', stake: 1, mult: 2 }),
    },
    {
        id: 'fall_r50',
        name: 'Fall Martingale – Vol 50',
        description: 'Buys FALL contracts on Volatility 50 (1s) Index. Martingale ×2 on loss.',
        identity: '1S',
        category: 'Rise / Fall',
        tag: 'Vol 50 (1s)',
        winChance: '~50%',
        getXml: () => riseFallXML({ symbol: '1HZ50V', market: 'synthetic_index', submarket: 'random_index', type: 'PUT', stake: 1, mult: 2 }),
    },
    {
        id: 'digit_match_r100',
        name: 'Digit Match 5 – Vol 100',
        description: 'Wins when the last digit of the closing price equals 5. Martingale ×3 on loss. Higher payout per win.',
        identity: 'MATCH',
        category: 'Digits',
        tag: 'Match',
        winChance: '~10%',
        getXml: () => digitXML({ symbol: 'R_100', market: 'synthetic_index', submarket: 'random_index', tradetype: 'digitmatch', contracttype: 'DIGITMATCH', prediction: 5, stake: 0.5, mult: 3 }),
    },
    {
        id: 'digit_differ_r100',
        name: 'Digit Differ 5 – Vol 100',
        description: 'Wins when the last digit is NOT 5. High ~90% win rate, lower payout. Martingale ×1.5 on loss.',
        identity: 'DIFF',
        category: 'Digits',
        tag: 'Differ',
        winChance: '~90%',
        getXml: () => digitXML({ symbol: 'R_100', market: 'synthetic_index', submarket: 'random_index', tradetype: 'digitdiff', contracttype: 'DIGITDIFF', prediction: 5, stake: 1, mult: 2 }),
    },
    {
        id: 'digit_over5_r50',
        name: 'Digit Over 5 – Vol 50',
        description: 'Wins when the last digit is greater than 5 (digits 6, 7, 8, 9). ~40% win chance. Martingale ×2.',
        identity: 'OVER',
        category: 'Digits',
        tag: 'Over 5',
        winChance: '~40%',
        getXml: () => digitXML({ symbol: 'R_50', market: 'synthetic_index', submarket: 'random_index', tradetype: 'digitover', contracttype: 'DIGITOVER', prediction: 5, stake: 1, mult: 2 }),
    },
    {
        id: 'digit_under5_r50',
        name: 'Digit Under 5 – Vol 50',
        description: 'Wins when the last digit is less than 5 (digits 0, 1, 2, 3, 4). ~50% win chance. Martingale ×2.',
        identity: 'UNDER',
        category: 'Digits',
        tag: 'Under 5',
        winChance: '~50%',
        getXml: () => digitXML({ symbol: 'R_50', market: 'synthetic_index', submarket: 'random_index', tradetype: 'digitunder', contracttype: 'DIGITUNDER', prediction: 5, stake: 1, mult: 2 }),
    },
    {
        id: 'digit_even_1hz100',
        name: 'Digit Even – Vol 100 (1s)',
        description: 'Wins when the last digit is even (0, 2, 4, 6, 8). ~50% win chance on 1-second ticks. Martingale ×2.',
        identity: 'EVEN',
        category: 'Digits',
        tag: 'Even',
        winChance: '~50%',
        getXml: () => digitXML({ symbol: '1HZ100V', market: 'synthetic_index', submarket: 'random_index', tradetype: 'digitodd', contracttype: 'DIGITEVEN', prediction: null, stake: 1, mult: 2 }),
    },
    {
        id: 'digit_odd_1hz100',
        name: 'Digit Odd – Vol 100 (1s)',
        description: 'Wins when the last digit is odd (1, 3, 5, 7, 9). ~50% win chance on fast 1-second ticks. Martingale ×2.',
        identity: 'ODD',
        category: 'Digits',
        tag: 'Odd',
        winChance: '~50%',
        getXml: () => digitXML({ symbol: '1HZ100V', market: 'synthetic_index', submarket: 'random_index', tradetype: 'digitodd', contracttype: 'DIGITODD', prediction: null, stake: 1, mult: 2 }),
    },
    {
        id: 'chacha_over_cycle',
        name: 'Chacha Over Cycle',
        description: 'Six-step cycle: Differ, Over 1, Over 2, Differ, Under 8, Under 7. A loss is recovered with one parity-matched Even/Odd trade.',
        identity: 'CYCLE',
        category: 'Cycle Bots',
        tag: 'Over 2',
        winChance: 'Signal-based',
        configurable: 'cycle',
        getXml: settings => chachaOverCycleXml(settings!),
    },
    {
        id: 'market_cycle_bot',
        name: 'Market Cycle Bot',
        description: 'Six-step cycle: Differ, Under 7, Under 6, Differ, Over 2, Over 3. A loss is recovered with one parity-matched Even/Odd trade.',
        identity: 'VH',
        category: 'Cycle Bots',
        tag: 'VH cycle',
        winChance: 'Signal-based',
        configurable: 'cycle',
        getXml: settings => marketCycleBotXml(settings!),
    },
    {
        id: 'over_2_killer',
        name: 'Over 2 Killer',
        description: 'Requires 2 or 3 consecutive digits below 3, then enters Digit Over 2 only on the following digit above 2. Optional VH uses simulated losses first.',
        identity: 'KILL',
        category: 'Cycle Bots',
        tag: 'Over 2',
        winChance: '~70%',
        configurable: 'killer',
        getXml: settings => over2KillerXml(settings!),
    },
];

const CATEGORIES = ['All', 'Rise / Fall', 'Digits', 'Cycle Bots'];
const DEFAULT_CYCLE_SETTINGS: TCycleBotSettings = {
    symbol: 'R_100',
    stake: 1,
    multiplier: 2,
};
const DEFAULT_KILLER_SETTINGS: TKillerSettings = {
    ...DEFAULT_CYCLE_SETTINGS,
    take_profit: 10,
    stop_loss: 5,
    confirmation: 3,
    vh_enabled: true,
    vh_target: 3,
};

/* ── Component ───────────────────────────────────────────────────────────── */

const FreeBots = observer(() => {
    const { dashboard, run_panel } = useStore();
    const [category, setCategory] = useState('All');
    const [loaded_id, setLoadedId] = useState<string | null>(null);
    const [loading_id, setLoadingId] = useState<string | null>(null);
    const [load_error, setLoadError] = useState<string | null>(null);
    const [cycle_settings, setCycleSettings] = useState<TCycleBotSettings>(DEFAULT_CYCLE_SETTINGS);
    const [killer_settings, setKillerSettings] = useState<TKillerSettings>(DEFAULT_KILLER_SETTINGS);

    const filtered = category === 'All' ? BOTS : BOTS.filter(b => b.category === category);

    const loadXmlWhenWorkspaceIsReady = async (
        xml: string,
        bot: TBot,
        run_after_load: boolean,
        attempts_left = 24
    ) => {
        const B = (window as any).Blockly;
        const workspace = B?.derivWorkspace;

        if (!workspace || !B?.Xml) {
            if (attempts_left > 0) {
                window.setTimeout(
                    () => loadXmlWhenWorkspaceIsReady(xml, bot, run_after_load, attempts_left - 1),
                    250
                );
            } else {
                setLoadingId(null);
                setLoadError('Bot Builder workspace did not finish loading. Please try again.');
            }
            return;
        }

        try {
            let dom = B.utils.xml.textToDom(xml);
            dom = new BlockConversion().convertStrategy(dom, false);
            const unsupported_blocks = Array.from(dom.querySelectorAll('block'))
                .map((block: Element) => block.getAttribute('type'))
                .filter((type: string | null) => type && !B.Blocks[type]);
            if (unsupported_blocks.length) {
                throw new Error(`Unsupported block types: ${[...new Set(unsupported_blocks)].join(', ')}`);
            }

            const event_group = `free-bot-load-${Date.now()}`;
            try {
                await loadWorkspace(dom, event_group, workspace);
            } finally {
                B.Events.setGroup(false);
            }
            workspace.clearUndo();
            workspace.current_strategy_id = B.utils.idGenerator.genUid();
            setLoadedId(bot.id);
            setLoadingId(null);
            if (run_after_load) {
                window.setTimeout(() => run_panel.onRunButtonClick(), 100);
            }
        } catch (err) {
            setLoadingId(null);
            setLoadError(`Failed to load bot: ${(err as Error).message ?? err}`);
        }
    };

    const loadBot = (bot: TBot, run_after_load = false) => {
        if (
            run_after_load &&
            !window.confirm(
                `Load and run “${bot.name}”? This can place trades on your currently selected account. Confirm the stake and use a demo account first.`
            )
        ) {
            return;
        }
        setLoadError(null);
        setLoadingId(bot.id);
        const settings = bot.configurable === 'killer' ? killer_settings : cycle_settings;
        const validation_error =
            bot.configurable === 'killer'
                ? validateKillerSettings(killer_settings)
                : bot.configurable === 'cycle'
                    ? validateCycleSettings(cycle_settings)
                    : null;
        if (validation_error) {
            setLoadingId(null);
            setLoadError(validation_error);
            return;
        }
        let xml: string;
        try {
            xml = bot.getXml(bot.configurable ? settings : undefined);
        } catch (error) {
            setLoadingId(null);
            setLoadError((error as Error).message || 'Unable to create this bot with the selected settings.');
            return;
        }

        // Switch to bot builder
        dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);

        // Bot Builder is lazy-loaded; wait until its Blockly workspace exists.
        window.setTimeout(() => loadXmlWhenWorkspaceIsReady(xml, bot, run_after_load), 250);
    };

    const downloadBot = (bot: TBot) => {
        const settings = bot.configurable === 'killer' ? killer_settings : cycle_settings;
        const validation_error =
            bot.configurable === 'killer'
                ? validateKillerSettings(killer_settings)
                : bot.configurable === 'cycle'
                    ? validateCycleSettings(cycle_settings)
                    : null;
        if (validation_error) {
            setLoadError(validation_error);
            return;
        }
        let xml: string;
        try {
            xml = bot.getXml(bot.configurable ? settings : undefined);
        } catch (error) {
            setLoadError((error as Error).message || 'Unable to create this bot with the selected settings.');
            return;
        }
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${bot.id}_martingale.xml`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className='free-bots'>
            {/* Header */}
            <div className='free-bots__header'>
                <div className='free-bots__header-text'>
                        <div className='free-bots__eyebrow'>ALPHATRADERS / BOT LIBRARY</div>
                        <h2 className='free-bots__title'>Free Strategy Bots</h2>
                    <p className='free-bots__subtitle'>
                        Ready-made Martingale bots for Digits and Rise/Fall markets.
                        Load a configured strategy into Bot Builder, then choose whether to run it from your workspace.
                    </p>
                </div>
                <div className='free-bots__warning'>
                    <strong>Risk warning</strong><span aria-hidden='true'> / </span>Martingale strategies can lead to large losses. Set a loss limit and test on a demo account first.
                </div>
            </div>

            {/* Filter tabs */}
            <div className='free-bots__filters'>
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        className={`free-bots__filter ${category === cat ? 'free-bots__filter--active' : ''}`}
                        onClick={() => setCategory(cat)}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {load_error && (
                <div className='free-bots__error' role='alert'>{load_error}</div>
            )}

            {/* Bot grid */}
            <div className='free-bots__grid'>
                {filtered.map(bot => (
                    <article key={bot.id} className={`free-bots__card free-bots__card--${bot.id} ${loaded_id === bot.id ? 'free-bots__card--loaded' : ''} ${loading_id === bot.id ? 'free-bots__card--loading' : ''}`}>
                        <div className='free-bots__card-top'>
                            <div className='free-bots__identity' aria-hidden='true'>
                                <span className='free-bots__identity-mark'>{bot.identity.slice(0, 1)}</span>
                                <span className='free-bots__identity-label'>{bot.identity}</span>
                            </div>
                            <div className='free-bots__tags'>
                                <span className='free-bots__tag'>{bot.category}</span>
                                <span className='free-bots__tag free-bots__tag--type'>{bot.tag}</span>
                            </div>
                        </div>

                        <h3 className='free-bots__card-name'>{bot.name}</h3>
                        <p className='free-bots__card-desc'>{bot.description}</p>

                        <div className='free-bots__stats'>
                            <div className='free-bots__stat'>
                                <span className='free-bots__stat-label'>Win Rate</span>
                                <span className='free-bots__stat-val'>{bot.winChance}</span>
                            </div>
                            <div className='free-bots__stat'>
                                <span className='free-bots__stat-label'>Strategy</span>
                                <span className='free-bots__stat-val'>Martingale ×2</span>
                            </div>
                        </div>
                        {bot.configurable === 'cycle' && (
                            <fieldset className='free-bots__settings'>
                                <legend>Cycle settings</legend>
                                <label>
                                    Symbol
                                    <select
                                        aria-label={`${bot.name} symbol`}
                                        value={cycle_settings.symbol}
                                        onChange={event => setCycleSettings({ ...cycle_settings, symbol: event.target.value })}
                                    >
                                        <option value='R_100'>Volatility 100 Index</option>
                                        <option value='R_50'>Volatility 50 Index</option>
                                        <option value='1HZ100V'>Volatility 100 (1s) Index</option>
                                    </select>
                                </label>
                                {(['stake', 'multiplier'] as const).map(name => (
                                    <label key={name}>
                                        {name === 'take_profit' ? 'Take profit' : name === 'stop_loss' ? 'Stop loss' : name}
                                        <input
                                            aria-label={`${bot.name} ${name.replace('_', ' ')}`}
                                            min='0.01'
                                            step='0.01'
                                            type='number'
                                            value={cycle_settings[name]}
                                            onChange={event => setCycleSettings({ ...cycle_settings, [name]: Number(event.target.value) })}
                                        />
                                    </label>
                                ))}
                            </fieldset>
                        )}
                        {bot.configurable === 'killer' && (
                            <fieldset className='free-bots__settings'>
                                <legend>Over 2 Killer settings</legend>
                                <label>Symbol<select aria-label={`${bot.name} symbol`} value={killer_settings.symbol} onChange={event => setKillerSettings({ ...killer_settings, symbol: event.target.value })}><option value='R_100'>Volatility 100 Index</option><option value='R_50'>Volatility 50 Index</option><option value='1HZ100V'>Volatility 100 (1s) Index</option></select></label>
                                {(['stake', 'multiplier', 'take_profit', 'stop_loss', 'vh_target'] as const).map(name => (
                                    <label key={name}>{name.replace('_', ' ')}<input aria-label={`${bot.name} ${name.replace('_', ' ')}`} min={name === 'vh_target' ? '1' : '0.01'} step={name === 'vh_target' ? '1' : '0.01'} type='number' value={killer_settings[name]} onChange={event => setKillerSettings({ ...killer_settings, [name]: Number(event.target.value) })} /></label>
                                ))}
                                <label>Below-3 confirmation<select aria-label={`${bot.name} confirmation`} value={killer_settings.confirmation} onChange={event => setKillerSettings({ ...killer_settings, confirmation: Number(event.target.value) })}><option value='2'>2 digits</option><option value='3'>3 digits</option></select></label>
                                <label className='free-bots__checkbox'><input aria-label={`${bot.name} enable volatility hunter`} type='checkbox' checked={killer_settings.vh_enabled} onChange={event => setKillerSettings({ ...killer_settings, vh_enabled: event.target.checked })} /> Enable VH simulated-loss filter</label>
                            </fieldset>
                        )}

                        {loaded_id === bot.id && (
                            <div className='free-bots__loaded-badge'><span aria-hidden='true' />Loaded into Bot Builder</div>
                        )}

                        <div className='free-bots__card-actions'>
                            <button className='free-bots__btn free-bots__btn--load' onClick={() => loadBot(bot)} aria-label={`Load ${bot.name} in Bot Builder`} disabled={loading_id === bot.id}>
                                <span className='free-bots__btn-indicator' aria-hidden='true' />{loading_id === bot.id ? 'Loading' : 'Load'}
                            </button>
                            <button className='free-bots__btn free-bots__btn--run' onClick={() => loadBot(bot, true)} aria-label={`Load and run ${bot.name}`} disabled={loading_id === bot.id}>
                                Load &amp; Run
                            </button>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
});

export default FreeBots;
