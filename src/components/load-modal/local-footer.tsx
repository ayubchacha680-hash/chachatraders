import React from 'react';
import { observer } from 'mobx-react-lite';
import { NOTIFICATION_TYPE } from '@/components/bot-notification/bot-notification-utils';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import Button from '../shared_ui/button';

const LocalFooter = observer(() => {
    const { load_modal, dashboard } = useStore();
    const {
        is_open_button_loading,
        is_open_button_disabled,
        loadStrategyOnBotBuilder,
        setLoadedLocalFile,
        saveStrategyToLocalStorage,
        toggleLoadModal,
    } = load_modal;
    const { setActiveTab, setOpenSettings, setPreviewOnPopup } = dashboard;
    const { isDesktop } = useDevice();
    const Wrapper = isDesktop ? React.Fragment : Button.Group;

    return (
        <Wrapper>
            {!isDesktop && (
                <Button text={localize('Cancel')} onClick={() => setLoadedLocalFile(null)} has_effect secondary large />
            )}
            <Button
                text={localize('Open')}
                onClick={async () => {
                    const loaded = await loadStrategyOnBotBuilder();
                    if (!loaded) return;
                    await saveStrategyToLocalStorage();
                    setLoadedLocalFile(null);
                    toggleLoadModal();
                    setPreviewOnPopup(false);
                    setOpenSettings(NOTIFICATION_TYPE.BOT_IMPORT);
                    setActiveTab(DBOT_TABS.BOT_BUILDER);
                }}
                is_loading={is_open_button_loading}
                has_effect
                primary
                large
                disabled={is_open_button_disabled}
            />
        </Wrapper>
    );
});

export default LocalFooter;
