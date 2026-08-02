import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import ChunkLoader from '@/components/loader/chunk-loader';

const BlocklyLoading = observer(() => {
    const { blockly_store } = useStore();
    const { is_loading } = blockly_store;

    if (!is_loading) return null;

    return <ChunkLoader message='Loading Blockly…' />;
});

export default BlocklyLoading;
