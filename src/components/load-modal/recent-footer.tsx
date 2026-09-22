// Removed unused React import - React 17+ JSX transform doesn't require it
import { observer } from 'mobx-react-lite';
import { NOTIFICATION_TYPE } from '@/components/bot-notification/bot-notification-utils';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import Button from '../shared_ui/button';

const RecentFooter = observer(() => {
    const { load_modal, dashboard } = useStore();
    const { is_open_button_loading, is_open_button_disabled, loadStrategyOnBotBuilder, toggleLoadModal } = load_modal;
    const { setActiveTab, setOpenSettings } = dashboard;

    return (
        <Button
            text={localize('Open')}
            onClick={async () => {
                const loaded = await loadStrategyOnBotBuilder();
                if (!loaded) return;
                toggleLoadModal();
                setOpenSettings(NOTIFICATION_TYPE.BOT_IMPORT);
                setActiveTab(DBOT_TABS.BOT_BUILDER);
            }}
            is_loading={is_open_button_loading}
            has_effect
            primary
            large
            disabled={is_open_button_disabled}
        />
    );
});

export default RecentFooter;
