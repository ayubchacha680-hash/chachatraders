// @ts-nocheck
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
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
    emoji: string;
    category: string;
    tag: string;
    winChance: string;
    getXml: () => string;
};

const BOTS: TBot[] = [
    {
        id: 'rise_r100',
        name: 'Rise Martingale – Vol 100',
        description: 'Buys RISE (CALL) contracts on Volatility 100 Index. Doubles stake on each loss, resets on win. 5-tick duration.',
        emoji: '📈',
        category: 'Rise / Fall',
        tag: 'Vol 100',
        winChance: '~50%',
        getXml: () => riseFallXML({ symbol: 'R_100', market: 'synthetic_index', submarket: 'random_index', type: 'CALL', stake: 1, mult: 2 }),
    },
    {
        id: 'fall_r100',
        name: 'Fall Martingale – Vol 100',
        description: 'Buys FALL (PUT) contracts on Volatility 100 Index. Doubles stake on each loss, resets on win. 5-tick duration.',
        emoji: '📉',
        category: 'Rise / Fall',
        tag: 'Vol 100',
        winChance: '~50%',
        getXml: () => riseFallXML({ symbol: 'R_100', market: 'synthetic_index', submarket: 'random_index', type: 'PUT', stake: 1, mult: 2 }),
    },
    {
        id: 'rise_r50',
        name: 'Rise Martingale – Vol 50',
        description: 'Buys RISE contracts on Volatility 50 Index with lower volatility. Martingale ×2 on loss.',
        emoji: '🚀',
        category: 'Rise / Fall',
        tag: 'Vol 50',
        winChance: '~50%',
        getXml: () => riseFallXML({ symbol: 'R_50', market: 'synthetic_index', submarket: 'random_index', type: 'CALL', stake: 1, mult: 2 }),
    },
    {
        id: 'fall_r50',
        name: 'Fall Martingale – Vol 50',
        description: 'Buys FALL contracts on Volatility 50 (1s) Index. Martingale ×2 on loss.',
        emoji: '🔻',
        category: 'Rise / Fall',
        tag: 'Vol 50 (1s)',
        winChance: '~50%',
        getXml: () => riseFallXML({ symbol: '1HZ50V', market: 'synthetic_index', submarket: 'random_index', type: 'PUT', stake: 1, mult: 2 }),
    },
    {
        id: 'digit_match_r100',
        name: 'Digit Match 5 – Vol 100',
        description: 'Wins when the last digit of the closing price equals 5. Martingale ×3 on loss. Higher payout per win.',
        emoji: '🎯',
        category: 'Digits',
        tag: 'Match',
        winChance: '~10%',
        getXml: () => digitXML({ symbol: 'R_100', market: 'synthetic_index', submarket: 'random_index', tradetype: 'digitmatch', contracttype: 'DIGITMATCH', prediction: 5, stake: 0.5, mult: 3 }),
    },
    {
        id: 'digit_differ_r100',
        name: 'Digit Differ 5 – Vol 100',
        description: 'Wins when the last digit is NOT 5. High ~90% win rate, lower payout. Martingale ×1.5 on loss.',
        emoji: '✂️',
        category: 'Digits',
        tag: 'Differ',
        winChance: '~90%',
        getXml: () => digitXML({ symbol: 'R_100', market: 'synthetic_index', submarket: 'random_index', tradetype: 'digitdiff', contracttype: 'DIGITDIFF', prediction: 5, stake: 1, mult: 2 }),
    },
    {
        id: 'digit_over5_r50',
        name: 'Digit Over 5 – Vol 50',
        description: 'Wins when the last digit is greater than 5 (digits 6, 7, 8, 9). ~40% win chance. Martingale ×2.',
        emoji: '⬆️',
        category: 'Digits',
        tag: 'Over 5',
        winChance: '~40%',
        getXml: () => digitXML({ symbol: 'R_50', market: 'synthetic_index', submarket: 'random_index', tradetype: 'digitover', contracttype: 'DIGITOVER', prediction: 5, stake: 1, mult: 2 }),
    },
    {
        id: 'digit_under5_r50',
        name: 'Digit Under 5 – Vol 50',
        description: 'Wins when the last digit is less than 5 (digits 0, 1, 2, 3, 4). ~50% win chance. Martingale ×2.',
        emoji: '⬇️',
        category: 'Digits',
        tag: 'Under 5',
        winChance: '~50%',
        getXml: () => digitXML({ symbol: 'R_50', market: 'synthetic_index', submarket: 'random_index', tradetype: 'digitunder', contracttype: 'DIGITUNDER', prediction: 5, stake: 1, mult: 2 }),
    },
    {
        id: 'digit_even_1hz100',
        name: 'Digit Even – Vol 100 (1s)',
        description: 'Wins when the last digit is even (0, 2, 4, 6, 8). ~50% win chance on 1-second ticks. Martingale ×2.',
        emoji: '⚖️',
        category: 'Digits',
        tag: 'Even',
        winChance: '~50%',
        getXml: () => digitXML({ symbol: '1HZ100V', market: 'synthetic_index', submarket: 'random_index', tradetype: 'digitodd', contracttype: 'DIGITEVEN', prediction: null, stake: 1, mult: 2 }),
    },
    {
        id: 'digit_odd_1hz100',
        name: 'Digit Odd – Vol 100 (1s)',
        description: 'Wins when the last digit is odd (1, 3, 5, 7, 9). ~50% win chance on fast 1-second ticks. Martingale ×2.',
        emoji: '🔢',
        category: 'Digits',
        tag: 'Odd',
        winChance: '~50%',
        getXml: () => digitXML({ symbol: '1HZ100V', market: 'synthetic_index', submarket: 'random_index', tradetype: 'digitodd', contracttype: 'DIGITODD', prediction: null, stake: 1, mult: 2 }),
    },
];

const CATEGORIES = ['All', 'Rise / Fall', 'Digits'];

/* ── Component ───────────────────────────────────────────────────────────── */

const FreeBots = observer(() => {
    const { dashboard } = useStore();
    const [category, setCategory] = useState('All');
    const [loaded_id, setLoadedId] = useState<string | null>(null);
    const [load_error, setLoadError] = useState<string | null>(null);

    const filtered = category === 'All' ? BOTS : BOTS.filter(b => b.category === category);

    const loadBot = (bot: TBot) => {
        setLoadError(null);
        const xml = bot.getXml();

        // Switch to bot builder
        dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);

        // Load XML into Blockly workspace after a short delay
        setTimeout(() => {
            try {
                const B = (window as any).Blockly;
                const ws = B?.derivWorkspace;
                if (ws) {
                    ws.clear();
                    const dom = B.Xml.textToDom(xml);
                    B.Xml.domToWorkspace(dom, ws);
                    setLoadedId(bot.id);
                } else {
                    setLoadError('Bot Builder workspace not ready. Switch to Bot Builder tab first, then try again.');
                }
            } catch (err) {
                setLoadError(`Failed to load bot: ${(err as Error).message ?? err}`);
            }
        }, 400);
    };

    const downloadBot = (bot: TBot) => {
        const blob = new Blob([bot.getXml()], { type: 'application/xml' });
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
                    <h2 className='free-bots__title'>🤖 Free Strategy Bots</h2>
                    <p className='free-bots__subtitle'>
                        Ready-made Martingale bots for Digits and Rise/Fall markets.
                        Click <strong>Load</strong> to open in Bot Builder, or <strong>Download</strong> to save the XML.
                    </p>
                </div>
                <div className='free-bots__warning'>
                    ⚠️ <strong>Risk warning:</strong> Martingale strategies can lead to large losses. Always set a loss limit and test on a demo account first.
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
                <div className='free-bots__error'>⚠️ {load_error}</div>
            )}

            {/* Bot grid */}
            <div className='free-bots__grid'>
                {filtered.map(bot => (
                    <div key={bot.id} className={`free-bots__card ${loaded_id === bot.id ? 'free-bots__card--loaded' : ''}`}>
                        <div className='free-bots__card-top'>
                            <span className='free-bots__emoji'>{bot.emoji}</span>
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

                        {loaded_id === bot.id && (
                            <div className='free-bots__loaded-badge'>✅ Loaded into Bot Builder</div>
                        )}

                        <div className='free-bots__card-actions'>
                            <button className='free-bots__btn free-bots__btn--load' onClick={() => loadBot(bot)}>
                                🚀 Load Bot
                            </button>
                            <button className='free-bots__btn free-bots__btn--dl' onClick={() => downloadBot(bot)}>
                                ⬇ XML
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

export default FreeBots;
