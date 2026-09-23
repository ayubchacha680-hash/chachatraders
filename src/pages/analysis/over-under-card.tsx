import clsx from 'clsx';
import Text from '@/components/shared_ui/text';
import { TOverUnderStats } from '@/services/analysis/digit-analysis';
import { Localize, localize } from '@deriv-com/translations';

type TOverUnderCardProps = {
    stats: TOverUnderStats;
    is_best_overall: boolean;
};

const OverUnderCard = ({ stats, is_best_overall }: TOverUnderCardProps) => {
    const {
        over_barrier,
        under_barrier,
        over_percentage,
        under_percentage,
        over_count,
        under_count,
        best_side,
        edge,
        over_entry_digit,
        under_entry_digit,
        entry_ticks,
    } = stats;
    const ticks_until_update = 10 - entry_ticks;

    return (
        <section
            className={clsx('analysis-card', 'analysis-card--pair', { 'analysis-card--highlight': is_best_overall })}
        >
            <div className='analysis-card__header'>
                <Text as='h3' size='xs' weight='bold' color='prominent'>
                    <Localize
                        i18n_default_text='Over {{over_barrier}} vs Under {{under_barrier}}'
                        values={{ over_barrier, under_barrier }}
                    />
                </Text>
                {is_best_overall && (
                    <span className='analysis-card__badge'>
                        <Localize i18n_default_text='Best in market' />
                    </span>
                )}
            </div>

            <div className='analysis-card__duel'>
                <div className={clsx('analysis-side', { 'analysis-side--leading': best_side === 'over' })}>
                    <Text as='span' size='xxs' color='less-prominent'>
                        <Localize i18n_default_text='Over {{over_barrier}}' values={{ over_barrier }} />
                    </Text>
                    <span className='analysis-card__entry-point'>
                        <span>Entry digit</span>
                        <strong>{over_entry_digit ?? '—'}</strong>
                    </span>
                    <Text as='span' size='m' weight='bold' color='prominent'>
                        {over_percentage.toFixed(2)}%
                    </Text>
                    <Text as='span' size='xxxs' color='less-prominent'>
                        {over_count.toLocaleString()}
                    </Text>
                </div>
                <div className={clsx('analysis-side', { 'analysis-side--leading': best_side === 'under' })}>
                    <Text as='span' size='xxs' color='less-prominent'>
                        <Localize i18n_default_text='Under {{under_barrier}}' values={{ under_barrier }} />
                    </Text>
                    <span className='analysis-card__entry-point'>
                        <span>Entry digit</span>
                        <strong>{under_entry_digit ?? '—'}</strong>
                    </span>
                    <Text as='span' size='m' weight='bold' color='prominent'>
                        {under_percentage.toFixed(2)}%
                    </Text>
                    <Text as='span' size='xxxs' color='less-prominent'>
                        {under_count.toLocaleString()}
                    </Text>
                </div>
            </div>

            <div className='analysis-card__bar' role='presentation'>
                <span
                    className='analysis-card__bar-fill analysis-card__bar-fill--over'
                    style={{ flexGrow: over_percentage }}
                />
                <span
                    className='analysis-card__bar-fill analysis-card__bar-fill--under'
                    style={{ flexGrow: under_percentage }}
                />
            </div>

            <div className='analysis-card__entry-refresh'>
                10-tick monitor · next update in {ticks_until_update} tick{ticks_until_update === 1 ? '' : 's'}
            </div>

            <Text as='p' size='xxs' color='general' className='analysis-card__verdict'>
                {best_side
                    ? localize('Trade {{side}} — {{edge}} pts ahead', {
                          side:
                              best_side === 'over'
                                  ? localize('Over {{over_barrier}}', { over_barrier })
                                  : localize('Under {{under_barrier}}', { under_barrier }),
                          edge: edge.toFixed(2),
                      })
                    : localize('Level — no edge either way')}
            </Text>
        </section>
    );
};

export default OverUnderCard;
