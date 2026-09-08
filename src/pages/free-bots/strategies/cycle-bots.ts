import { TStrategySettings, validateStrategySettings } from './strategy-helpers';

export type TCycleBotSettings = Pick<TStrategySettings, 'stake' | 'multiplier'> & { symbol: string };
export type TKillerSettings = TStrategySettings & {
    symbol: string;
    confirmation: number;
    vh_enabled: boolean;
    vh_target: number;
};

const escapeXml = (value: string | number) =>
    String(value).replace(/[<>&'"]/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character] as string));
const number = (value: number) => `<shadow type="math_number"><field name="NUM">${value}</field></shadow>`;
const variable = (id: string, name: string) => `<block type="variables_get"><field name="VAR" id="${id}">${name}</field></block>`;
const set = (id: string, name: string, value: string) => `<block type="variables_set"><field name="VAR" id="${id}">${name}</field><value name="VALUE">${value}</value></block>`;
const chain = (...blocks: string[]) =>
    blocks.reduceRight((next, block) => {
        const closing_index = block.lastIndexOf('</block>');
        return closing_index < 0
            ? block
            : `${block.slice(0, closing_index)}${next ? `<next>${next}</next>` : ''}${block.slice(closing_index)}`;
    }, '');
const withNext = (block: string, next: string) => {
    const closing_index = block.lastIndexOf('</block>');
    return `${block.slice(0, closing_index)}<next>${next}</next>${block.slice(closing_index)}`;
};
const multiply = (left: string, right: string) =>
    `<block type="math_arithmetic"><field name="OP">MULTIPLY</field><value name="A">${left}</value><value name="B">${right}</value></block>`;
const add = (left: string, right: string) =>
    `<block type="math_arithmetic"><field name="OP">ADD</field><value name="A">${left}</value><value name="B">${right}</value></block>`;
const bool = (value: boolean) => `<block type="logic_boolean"><field name="BOOL">${value ? 'TRUE' : 'FALSE'}</field></block>`;
const lastDigit = () => '<block type="last_digit"/>';
const compare = (left: string, operation: string, right: string) =>
    `<block type="logic_compare"><field name="OP">${operation}</field><value name="A">${left}</value><value name="B">${right}</value></block>`;
const modulo = (left: string, right: string) =>
    `<block type="math_modulo"><value name="DIVIDEND">${left}</value><value name="DIVISOR">${right}</value></block>`;
const purchase = (contract: string, prediction = number(0)) =>
    `<block type="free_bot_purchase"><field name="PURCHASE_LIST">${contract}</field><value name="PREDICTION">${prediction}</value></block>`;
const conditional = (branches: { condition: string; statement: string }[], otherwise = '') => {
    const mutation = `<mutation elseif="${Math.max(0, branches.length - 1)}" else="${otherwise ? 1 : 0}"></mutation>`;
    const cases = branches
        .map(
            ({ condition, statement }, index) =>
                `<value name="IF${index}">${condition}</value><statement name="DO${index}">${statement}</statement>`
        )
        .join('');
    return `<block type="controls_if">${mutation}${cases}${otherwise ? `<statement name="ELSE">${otherwise}</statement>` : ''}</block>`;
};

const tradeDefinition = (symbol: string, contract: 'DIGITDIFF' | 'DIGITOVER', amount: string, prediction: string) => `
<block type="trade_definition" id="trade" x="0" y="0"><statement name="TRADE_OPTIONS"><block type="trade_definition_market" id="market" deletable="false" movable="false"><field name="MARKET_LIST">synthetic_index</field><field name="SUBMARKET_LIST">random_index</field><field name="SYMBOL_LIST">${escapeXml(symbol)}</field><next><block type="trade_definition_tradetype" id="type" deletable="false" movable="false"><field name="TRADETYPECAT_LIST">digits</field><field name="TRADETYPE_LIST">${contract === 'DIGITDIFF' ? 'digitdiff' : 'digitover'}</field><next><block type="trade_definition_contracttype" id="contract" deletable="false" movable="false"><field name="TYPE_LIST">${contract}</field><next><block type="trade_definition_candleinterval" id="interval" deletable="false" movable="false"><field name="CANDLEINTERVAL_LIST">60</field></block></next></block></next></block></next></block></statement><statement name="SUBMARKET"><block type="trade_definition_tradeoptions" id="options"><mutation has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation><field name="DURATIONTYPE_LIST">t</field><field name="CURRENCY_LIST">USD</field><value name="DURATION">${number(1)}</value><value name="AMOUNT">${amount}</value><value name="PREDICTION">${prediction}</value></block></statement>`;

type TCycleStep = { contract: 'DIGITDIFF' | 'DIGITOVER' | 'DIGITUNDER'; prediction?: number };

const sixStepCycleXml = (settings: TCycleBotSettings, name: string, steps: TCycleStep[]) => {
    if (!Number.isFinite(settings.stake) || settings.stake <= 0 || !Number.isFinite(settings.multiplier) || settings.multiplier < 1) {
        throw new Error('Stake must be greater than zero and multiplier must be at least 1.');
    }
    const recovery = variable('recovery', 'cycle:recovery pending');
    const step = variable('step', 'cycle:step');
    const advance_step = set(
        'step',
        'cycle:step',
        `<block type="math_modulo"><value name="DIVIDEND">${add(step, number(1))}</value><value name="DIVISOR">${number(steps.length)}</value></block>`
    );
    const normal_purchase = conditional(
        steps.map((cycle_step, index) => ({
            condition: compare(step, 'EQ', number(index)),
            statement: purchase(
                cycle_step.contract,
                cycle_step.contract === 'DIGITDIFF' ? lastDigit() : number(cycle_step.prediction!)
            ),
        }))
    );
    const recovery_purchase = conditional(
        [{ condition: compare(modulo(lastDigit(), number(2)), 'EQ', number(0)), statement: purchase('DIGITEVEN') }],
        purchase('DIGITODD')
    );
    const before_purchase = conditional([{ condition: recovery, statement: recovery_purchase }], normal_purchase);
    const loss_actions = chain(
        set('stake', 'cycle:stake', multiply(variable('stake', 'cycle:stake'), variable('mult', 'cycle:multiplier'))),
        conditional(
            [{ condition: recovery, statement: chain(set('recovery', 'cycle:recovery pending', bool(false)), advance_step) }],
            set('recovery', 'cycle:recovery pending', bool(true))
        )
    );
    const win_actions = chain(
        set('stake', 'cycle:stake', variable('initial', 'cycle:initial')),
        set('recovery', 'cycle:recovery pending', bool(false)),
        advance_step
    );
    const after_result = conditional(
        [{ condition: '<block type="contract_check_result"><field name="CHECK_RESULT">loss</field></block>', statement: loss_actions }],
        win_actions
    );
    return `<xml xmlns="http://www.w3.org/1999/xhtml" collection="false" is_dbot="true"><variables>
<variable id="stake">cycle:stake</variable><variable id="initial">cycle:initial</variable><variable id="mult">cycle:multiplier</variable><variable id="step">cycle:step</variable><variable id="recovery">cycle:recovery pending</variable>
</variables>${tradeDefinition(settings.symbol, 'DIGITDIFF', variable('stake', 'cycle:stake'), number(0))}
<statement name="INITIALIZATION">${chain(set('stake', 'cycle:stake', number(settings.stake)), set('initial', 'cycle:initial', number(settings.stake)), set('mult', 'cycle:multiplier', number(settings.multiplier)), set('step', 'cycle:step', number(0)), set('recovery', 'cycle:recovery pending', bool(false)))}</statement></block>
<block type="before_purchase" id="before" x="0" y="560"><statement name="BEFOREPURCHASE_STACK">${before_purchase}</statement></block>
<block type="after_purchase" id="after" x="520" y="560"><statement name="AFTERPURCHASE_STACK">${withNext(after_result, '<block type="trade_again"/>')}</statement></block>
<comment pinned="false" h="70" w="360">${name}: ${steps.map(item => item.contract.replace('DIGIT', '') + (item.prediction ?? '')).join(' → ')}. A loss triggers exactly one latest-digit Even/Odd recovery trade.</comment></xml>`;
};

export const chachaOverCycleXml = (settings: TCycleBotSettings) =>
    sixStepCycleXml(settings, 'Chacha Over Cycle', [
        { contract: 'DIGITDIFF' }, { contract: 'DIGITOVER', prediction: 1 }, { contract: 'DIGITOVER', prediction: 2 },
        { contract: 'DIGITDIFF' }, { contract: 'DIGITUNDER', prediction: 8 }, { contract: 'DIGITUNDER', prediction: 7 },
    ]);
export const marketCycleBotXml = (settings: TCycleBotSettings) =>
    sixStepCycleXml(settings, 'Market Cycle Bot', [
        { contract: 'DIGITDIFF' }, { contract: 'DIGITUNDER', prediction: 7 }, { contract: 'DIGITUNDER', prediction: 6 },
        { contract: 'DIGITDIFF' }, { contract: 'DIGITOVER', prediction: 2 }, { contract: 'DIGITOVER', prediction: 3 },
    ]);

export const over2KillerXml = (settings: TKillerSettings) => {
    const validation = validateStrategySettings(settings);
    if (
        validation ||
        ![2, 3].includes(settings.confirmation) ||
        !Number.isInteger(settings.vh_target) ||
        (settings.vh_enabled && settings.vh_target < 1)
    )
        throw new Error(validation || 'Confirmation must be 2 or 3 and enabled VH target must be at least 1.');

    const low = variable('low', 'killer:below 3 count');
    const signal = variable('signal', 'killer:qualifying signal');
    const virtual_open = variable('virtual', 'killer:virtual trade open');
    const vh = variable('vh', 'killer:simulated losses');
    const settle_virtual = conditional([
        {
            condition: virtual_open,
            statement: chain(
                conditional([
                    {
                        condition: compare(lastDigit(), 'LTE', number(2)),
                        statement: set('vh', 'killer:simulated losses', add(vh, number(1))),
                    },
                ]),
                set('virtual', 'killer:virtual trade open', bool(false))
            ),
        },
    ]);
    const detect_signal = conditional(
        [
            {
                condition: compare(lastDigit(), 'LT', number(3)),
                statement: chain(
                    set('low', 'killer:below 3 count', add(low, number(1))),
                    set('signal', 'killer:qualifying signal', bool(false))
                ),
            },
        ],
        chain(
            set('signal', 'killer:qualifying signal', compare(low, 'GTE', number(settings.confirmation))),
            set('low', 'killer:below 3 count', number(0))
        )
    );
    const real_entry = chain(
        set('vh', 'killer:simulated losses', number(0)),
        set('signal', 'killer:qualifying signal', bool(false)),
        purchase('DIGITOVER', number(2))
    );
    const virtual_entry = chain(
        set('virtual', 'killer:virtual trade open', bool(true)),
        set('signal', 'killer:qualifying signal', bool(false))
    );
    const entry = conditional([
        {
            condition: signal,
            statement: conditional(
                [{ condition: settings.vh_enabled ? compare(vh, 'GTE', number(settings.vh_target)) : bool(true), statement: real_entry }],
                virtual_entry
            ),
        },
    ]);
    const update_stake = conditional(
        [
            {
                condition: '<block type="contract_check_result"><field name="CHECK_RESULT">loss</field></block>',
                statement: set(
                    'stake',
                    'killer:stake',
                    multiply(variable('stake', 'killer:stake'), variable('mult', 'killer:multiplier'))
                ),
            },
        ],
        set('stake', 'killer:stake', variable('initial', 'killer:initial'))
    );
    const within_limits = `<block type="logic_operation"><field name="OP">AND</field><value name="A">${compare(variable('profit', 'killer:total profit'), 'LT', variable('tp', 'killer:take profit'))}</value><value name="B">${compare(variable('profit', 'killer:total profit'), 'GT', `<block type="math_single"><field name="OP">NEG</field><value name="NUM">${variable('sl', 'killer:stop loss')}</value></block>`)}</value></block>`;
    const after_purchase = chain(
        set(
            'profit',
            'killer:total profit',
            add(
                variable('profit', 'killer:total profit'),
                '<block type="read_details"><field name="DETAIL_INDEX">4</field></block>'
            )
        ),
        update_stake,
        conditional([{ condition: within_limits, statement: '<block type="trade_again"/>' }])
    );

    return `<xml xmlns="http://www.w3.org/1999/xhtml" collection="false" is_dbot="true"><variables>
<variable id="stake">killer:stake</variable><variable id="initial">killer:initial</variable><variable id="mult">killer:multiplier</variable><variable id="profit">killer:total profit</variable><variable id="low">killer:below 3 count</variable><variable id="signal">killer:qualifying signal</variable><variable id="virtual">killer:virtual trade open</variable><variable id="vh">killer:simulated losses</variable><variable id="tp">killer:take profit</variable><variable id="sl">killer:stop loss</variable>
</variables>${tradeDefinition(settings.symbol, 'DIGITOVER', variable('stake', 'killer:stake'), number(2))}
<statement name="INITIALIZATION">${chain(set('stake', 'killer:stake', number(settings.stake)), set('initial', 'killer:initial', number(settings.stake)), set('mult', 'killer:multiplier', number(settings.multiplier)), set('tp', 'killer:take profit', number(settings.take_profit)), set('sl', 'killer:stop loss', number(settings.stop_loss)), set('low', 'killer:below 3 count', number(0)), set('profit', 'killer:total profit', number(0)), set('vh', 'killer:simulated losses', number(0)), set('signal', 'killer:qualifying signal', bool(false)), set('virtual', 'killer:virtual trade open', bool(false)))}</statement></block>
<block type="tick_analysis" id="killer_ticks" x="0" y="500"><statement name="TICKANALYSIS_STACK">${chain(settle_virtual, detect_signal)}</statement></block>
<block type="before_purchase" id="killer_before" x="0" y="760"><statement name="BEFOREPURCHASE_STACK">${entry}</statement></block>
<block type="after_purchase" id="killer_after" x="520" y="600"><statement name="AFTERPURCHASE_STACK">${after_purchase}</statement></block>
<comment pinned="false" h="70" w="300">Over 2 Killer: ${settings.confirmation} below-3 digits then a digit over 2. VH ${settings.vh_enabled ? `simulates ${settings.vh_target} losses before the next real entry` : 'disabled'}; TP/SL gate the real-trade loop.</comment></xml>`;
};