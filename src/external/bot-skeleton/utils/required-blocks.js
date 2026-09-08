export const matchesRequiredBlockType = (block_type, required_type) =>
    block_type === required_type || (required_type === 'purchase' && block_type === 'free_bot_purchase');

export const getMissingRequiredBlockTypes = (block_types, required_types) =>
    required_types.filter(required_type => !block_types.some(block_type => matchesRequiredBlockType(block_type, required_type)));