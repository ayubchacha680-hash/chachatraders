import Text from '@/components/shared_ui/text';
import { TEvenOddStats } from '@/services/analysis/digit-analysis';
import { Localize, localize } from '@deriv-com/translations';

type TEvenOddCardProps = {
    stats: TEvenOddStats;
    sample_size: number;
};

const EvenOddCard = ({ stats, sample_size }: TEvenOddCardProps) => {
    const { even_percentage, odd_percentage, even_count, odd_count, bias, bias_edge } = stats;

    return (
        <section className='analysis-card'>
            <div className='analysis-card__header'>
                <Text as='h3' size='s' weight='bold' color='prominent'>
                    <Localize i18n_default_text='Even / Odd bias' />
                </Text>
                <Text as='span' size='xxs' color='less-prominent'>
                    <Localize
                        i18n_default_text='{{sample_size}} ticks'
                        values={{ sample_size: sample_size.toLocaleString() }}
                    />
                </Text>
            </div>

            <div className='analysis-card__duel'>
                <div className={`analysis-side ${bias === 'even' ? 'analysis-side--leading' : ''}`}>
                    <Text as='span' size='xxs' color='less-prominent'>
                        <Localize i18n_default_text='Even' />
                    </Text>
                    <Text as='span' size='l' weight='bold' color='prominent'>
                        {even_percentage.toFixed(2)}%
                    </Text>
                    <Text as='span' size='xxxs' color='less-prominent'>
                        {even_count.toLocaleString()}
                    </Text>
                </div>
                <div className={`analysis-side ${bias === 'odd' ? 'analysis-side--leading' : ''}`}>
                    <Text as='span' size='xxs' color='less-prominent'>
                        <Localize i18n_default_text='Odd' />
                    </Text>
                    <Text as='span' size='l' weight='bold' color='prominent'>
                        {odd_percentage.toFixed(2)}%
                    </Text>
                    <Text as='span' size='xxxs' color='less-prominent'>
                        {odd_count.toLocaleString()}
                    </Text>
                </div>
            </div>

            <div className='analysis-card__bar' role='presentation'>
                <span
                    className='analysis-card__bar-fill analysis-card__bar-fill--even'
                    style={{ flexGrow: even_percentage }}
                />
                <span
                    className='analysis-card__bar-fill analysis-card__bar-fill--odd'
                    style={{ flexGrow: odd_percentage }}
                />
            </div>

            <Text as='p' size='xxs' color='general' className='analysis-card__verdict'>
                {bias
                    ? localize('Bias: {{side}} by {{edge}} pts', {
                          side: bias === 'even' ? localize('Even') : localize('Odd'),
                          edge: bias_edge.toFixed(2),
                      })
                    : localize('No bias — both sides are level')}
            </Text>
        </section>
    );
};

export default EvenOddCard;
