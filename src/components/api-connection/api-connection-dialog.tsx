import { useState } from 'react';
import Button from '@/components/shared_ui/button';
import Text from '@/components/shared_ui/text';
import { isValidDerivAppId, setDerivAppId } from '@/utils/deriv-app-id';
import { Localize, localize } from '@deriv-com/translations';
import './api-connection-dialog.scss';

type TApiConnectionDialogProps = {
    onClose: () => void;
};

const DERIV_DASHBOARD_URL = 'https://api.deriv.com/dashboard';

/**
 * Collects the Deriv app id needed for OAuth and the authenticated REST/WebSocket
 * calls. The build-time `NEXT_PUBLIC_DERIV_APP_ID` stays the default; a value saved
 * here overrides it so an already-deployed build can be connected without a rebuild.
 */
const ApiConnectionDialog = ({ onClose }: TApiConnectionDialogProps) => {
    const [app_id, setAppId] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSave = () => {
        if (!isValidDerivAppId(app_id)) {
            setError(localize('Enter the numeric app id from your Deriv API dashboard.'));
            return;
        }
        setDerivAppId(app_id);
        onClose();
    };

    return (
        <div className='api-connection__backdrop' onClick={onClose}>
            <div
                className='api-connection'
                role='dialog'
                aria-label={localize('Connect Deriv API')}
                onClick={event => event.stopPropagation()}
            >
                <Text as='h2' size='s' weight='bold' color='prominent'>
                    <Localize i18n_default_text='Connect Deriv API' />
                </Text>
                <Text as='p' size='xxs' color='general'>
                    <Localize i18n_default_text='Log in and Sign up use Deriv OAuth, which needs the app id of a Deriv app registered with this site as its redirect URL. Live market data on the Analysis tab works without it.' />
                </Text>

                <label className='api-connection__field'>
                    <Text as='span' size='xxs' color='less-prominent'>
                        <Localize i18n_default_text='Deriv app id' />
                    </Text>
                    <input
                        autoFocus
                        inputMode='numeric'
                        value={app_id}
                        placeholder='e.g. 12345'
                        onChange={event => {
                            setAppId(event.target.value);
                            setError(null);
                        }}
                        onKeyDown={event => event.key === 'Enter' && handleSave()}
                    />
                </label>

                {error && (
                    <Text as='p' size='xxs' color='loss-danger'>
                        {error}
                    </Text>
                )}

                <Text as='p' size='xxxs' color='less-prominent'>
                    <Localize
                        i18n_default_text='Register an app at {{url}} with redirect URL {{origin}}.'
                        values={{ url: DERIV_DASHBOARD_URL, origin: window.location.origin }}
                    />
                </Text>

                <div className='api-connection__actions'>
                    <Button secondary onClick={onClose}>
                        <Localize i18n_default_text='Cancel' />
                    </Button>
                    <Button primary onClick={handleSave}>
                        <Localize i18n_default_text='Save and connect' />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ApiConnectionDialog;
