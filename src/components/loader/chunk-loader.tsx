import './chunk-loader.scss';

export default function ChunkLoader({ message }: { message: string }) {
    return (
        <div className='cct-loader'>
            {/* Animated rings */}
            <div className='cct-loader__rings'>
                <div className='cct-loader__ring cct-loader__ring--1' />
                <div className='cct-loader__ring cct-loader__ring--2' />
                <div className='cct-loader__ring cct-loader__ring--3' />
                {/* Core logo */}
                <div className='cct-loader__core'>
                    <span className='cct-loader__cc'>CC</span>
                    <span className='cct-loader__t'>T</span>
                </div>
            </div>

            {/* Brand name */}
            <div className='cct-loader__brand'>
                <span className='cct-loader__brand-sub'>chachatraders</span>
            </div>

            {/* Message */}
            <p className='cct-loader__message'>{message}</p>

            {/* Dot bounce */}
            <div className='cct-loader__dots'>
                <span /><span /><span />
            </div>
        </div>
    );
}
