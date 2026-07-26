import { useEffect, useRef, useState } from 'react';
import Button from '@/components/shared_ui/button';
import Text from '@/components/shared_ui/text';
import { authorizePAT, loadStoredAccounts, removeAccount, saveAccount, TPATAccount } from '@/services/pat-auth';
import { Localize, localize } from '@deriv-com/translations';
import './api-connection-dialog.scss';

type TApiConnectionDialogProps = {
    onClose: () => void;
};

const ApiConnectionDialog = ({ onClose }: TApiConnectionDialogProps) => {
    const [token, setToken] = useState('');
    const [accounts, setAccounts] = useState<TPATAccount[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success_msg, setSuccessMsg] = useState<string | null>(null);
    const input_ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setAccounts(loadStoredAccounts());
        setTimeout(() => input_ref.current?.focus(), 50);
    }, []);

    const handleConnect = async () => {
        const trimmed = token.trim();
        if (!trimmed) {
            setError(localize('Please enter a PAT token.'));
            return;
        }
        setLoading(true);
        setError(null);
        setSuccessMsg(null);

        const result = await authorizePAT(trimmed);
        setLoading(false);

        if (!result.ok) {
            setError(result.error);
            return;
        }

        saveAccount(result.account);
        setAccounts(loadStoredAccounts());
        setToken('');
        setSuccessMsg(
            localize('Connected: {{loginid}} ({{currency}})', {
                loginid: result.account.loginid,
                currency: result.account.currency,
            })
        );

        // Re-init api_base so the new token is picked up
        try {
            const { api_base } = await import('@/external/bot-skeleton');
            await api_base.init(true);
        } catch {
            // Non-fatal — page refresh will pick up the new account
        }
    };

    const handleRemove = (loginid: string) => {
        removeAccount(loginid);
        setAccounts(loadStoredAccounts());
    };

    const handleSetActive = (account: TPATAccount) => {
        import('@/external/bot-skeleton').then(({ api_base }) => {
            localStorage.setItem('active_loginid', account.loginid);
            localStorage.setItem('account_type', account.is_virtual ? 'demo' : 'real');
            api_base.init(true).catch(() => {});
        });
        setSuccessMsg(localize('Switched to {{loginid}}', { loginid: account.loginid }));
    };

    return (
        <div className='pat-dialog__backdrop' onClick={onClose}>
            <div
                className='pat-dialog'
                role='dialog'
                aria-label={localize('API Token Connection')}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className='pat-dialog__header'>
                    <div className='pat-dialog__header-icon'>🔑</div>
                    <div>
                        <Text as='h2' size='s' weight='bold' color='prominent'>
                            <Localize i18n_default_text='Connect with API Token' />
                        </Text>
                        <Text as='p' size='xxs' color='less-prominent'>
                            <Localize i18n_default_text='Use your Deriv Personal Access Token (PAT) to connect your account.' />
                        </Text>
                    </div>
                </div>

                {/* How to get a token */}
                <div className='pat-dialog__info'>
                    <Text as='span' size='xxxs' color='less-prominent'>
                        💡{' '}
                        <Localize i18n_default_text='Get your PAT at ' />
                    </Text>
                    <a
                        href='https://app.deriv.com/account/api-token'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='pat-dialog__link'
                    >
                        app.deriv.com/account/api-token
                    </a>
                    <Text as='span' size='xxxs' color='less-prominent'>
                        <Localize i18n_default_text='. Select scopes: Read, Trade, Payments.' />
                    </Text>
                </div>

                {/* Token input */}
                <div className='pat-dialog__input-row'>
                    <input
                        ref={input_ref}
                        className='pat-dialog__input'
                        type='password'
                        value={token}
                        placeholder={localize('Paste your PAT token here…')}
                        onChange={e => {
                            setToken(e.target.value);
                            setError(null);
                            setSuccessMsg(null);
                        }}
                        onKeyDown={e => e.key === 'Enter' && handleConnect()}
                        autoComplete='off'
                    />
                    <Button
                        primary
                        onClick={handleConnect}
                        is_disabled={loading || !token.trim()}
                        className='pat-dialog__connect-btn'
                    >
                        {loading ? <Localize i18n_default_text='Connecting…' /> : <Localize i18n_default_text='Connect' />}
                    </Button>
                </div>

                {error && (
                    <div className='pat-dialog__msg pat-dialog__msg--error'>
                        <span>⚠️</span> {error}
                    </div>
                )}
                {success_msg && (
                    <div className='pat-dialog__msg pat-dialog__msg--success'>
                        <span>✅</span> {success_msg}
                    </div>
                )}

                {/* Connected accounts */}
                {accounts.length > 0 && (
                    <div className='pat-dialog__accounts'>
                        <Text as='p' size='xxs' weight='bold' color='prominent' className='pat-dialog__accounts-title'>
                            <Localize i18n_default_text='Connected Accounts' />
                        </Text>
                        <div className='pat-dialog__account-list'>
                            {accounts.map(acc => (
                                <div key={acc.loginid} className='pat-dialog__account-row'>
                                    <div className='pat-dialog__account-info'>
                                        <span className={`pat-dialog__account-badge ${acc.is_virtual ? 'demo' : 'real'}`}>
                                            {acc.is_virtual ? 'DEMO' : 'REAL'}
                                        </span>
                                        <Text as='span' size='xs' weight='bold' color='prominent'>
                                            {acc.loginid}
                                        </Text>
                                        <Text as='span' size='xxs' color='less-prominent'>
                                            {acc.currency} · {acc.balance?.toFixed(2) ?? '—'}
                                        </Text>
                                    </div>
                                    <div className='pat-dialog__account-actions'>
                                        <button
                                            className='pat-dialog__action-btn pat-dialog__action-btn--switch'
                                            onClick={() => handleSetActive(acc)}
                                            title={localize('Set as active')}
                                        >
                                            ↗
                                        </button>
                                        <button
                                            className='pat-dialog__action-btn pat-dialog__action-btn--remove'
                                            onClick={() => handleRemove(acc.loginid)}
                                            title={localize('Remove')}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className='pat-dialog__footer'>
                    <Button secondary onClick={onClose}>
                        <Localize i18n_default_text='Close' />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ApiConnectionDialog;
