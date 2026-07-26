import './chunk-loader.scss';

export default function ChunkLoader({ message }: { message: string }) {
    return (
        <div className='chunk-loader'>
            <div className='chunk-loader__spinner'>
                <div className='chunk-loader__ring chunk-loader__ring--1' />
                <div className='chunk-loader__ring chunk-loader__ring--2' />
                <div className='chunk-loader__ring chunk-loader__ring--3' />
                <div className='chunk-loader__core'>
                    <span className='chunk-loader__bot-icon'>🤖</span>
                </div>
            </div>
            <p className='chunk-loader__message'>{message}</p>
            <div className='chunk-loader__dots'>
                <span /><span /><span />
            </div>
        </div>
    );
}
