import { localize } from '@deriv-com/translations';

// Unlike the normal Purchase block this intentionally has a fixed menu. Free
// strategies can switch digit families without trade-definition onchange code
// replacing the selected value while XML is being loaded.
window.Blockly.Blocks.free_bot_purchase = {
    init() {
        this.jsonInit({
            message0: localize('Free bot purchase {{ contract_type }} barrier {{ barrier }}', {
                contract_type: '%1',
                barrier: '%2',
            }),
            args0: [{
                type: 'field_dropdown',
                name: 'PURCHASE_LIST',
                options: [
                    ['Digit Differ', 'DIGITDIFF'],
                    ['Digit Over', 'DIGITOVER'],
                    ['Digit Under', 'DIGITUNDER'],
                    ['Digit Even', 'DIGITEVEN'],
                    ['Digit Odd', 'DIGITODD'],
                ],
            }, {
                type: 'input_value',
                name: 'PREDICTION',
                check: 'Number',
            }],
            previousStatement: null,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            tooltip: localize('Purchases the selected free strategy digit contract.'),
            category: window.Blockly.Categories.Before_Purchase,
        });
        this.setNextStatement(false);
    },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.free_bot_purchase = block => {
    if (!block?.getFieldValue) {
        throw new Error('Free bot purchase block is unavailable during code generation.');
    }
    const prediction =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'PREDICTION',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || 0;
    return `Bot.purchaseFreeBot('${block.getFieldValue('PURCHASE_LIST')}', ${prediction});\n`;
};