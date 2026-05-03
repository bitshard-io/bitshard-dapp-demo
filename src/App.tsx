import { useCallback, useMemo, useState } from 'react';
import {
    useAccount,
    useBalance,
    useChainId,
    useChains,
    useConnect,
    useConnections,
    useDisconnect,
    useSendTransaction,
    useSignMessage,
    useSwitchChain
} from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { parseEther, type Hex } from 'viem';

import type { BitShardProvider } from '@bitshard.io/bitshard-wagmi-connector';

type Props = {
    appUrl: string;
};

const DEFAULT_RECIPIENT = '0x000000000000000000000000000000000000dEaD';
const DEFAULT_VALUE = '0.0001';

// chainIds known to be supported by the BitShard backend today. This is
// purely cosmetic on the demo side — the popup is the source of truth and
// will reject anything else with a clear message.
const BITSHARD_SUPPORTED_IDS = new Set<number>([42161, 42170, 421614]);

export function App({ appUrl }: Props) {
    return (
        <div className="app">
            <div className="header">
                <h1>BitShard demo dApp</h1>
                <ChainBadge />
            </div>

            <p className="muted" style={{ margin: 0 }}>
                This example uses <span className="kbd">@bitshard.io/bitshard-wagmi-connector</span> to connect a third-party dApp
                to a BitShard wallet. The connector opens a popup to <a href={appUrl} target="_blank" rel="noreferrer">{appUrl}</a>,
                where you approve the action on your selected wallet.
            </p>

            <ConnectCard />
            <SignMessageCard />
            <SendTransactionCard />
        </div>
    );
}

function WalletIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <circle cx="17" cy="14" r="1.5" />
        </svg>
    );
}

function ChainBadge() {
    const chainId = useChainId();
    const chains = useChains();
    const current = chains.find((c) => c.id === chainId);
    const supported = BITSHARD_SUPPORTED_IDS.has(chainId);
    return (
        <span
            className="tag"
            style={!supported ? { color: '#b3261e', background: 'rgba(179,38,30,0.08)', borderColor: 'rgba(179,38,30,0.2)' } : undefined}
            title={supported ? 'Supported by BitShard' : 'Not supported by BitShard yet'}
        >
            {current?.name ?? `Chain ${chainId}`}
        </span>
    );
}

function ConnectCard() {
    const { connect, connectors, isPending: isConnecting, error: connectError } = useConnect();
    const { disconnect } = useDisconnect();
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const chains = useChains();
    const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();
    const { data: balance } = useBalance({ address, query: { enabled: Boolean(address) } });
    const connections = useConnections();

    const bitshardConnector = useMemo(() => connectors.find((c) => c.id === 'bitshard'), [connectors]);
    const activeConnector = connections[0]?.connector;

    const openViewer = useCallback(async (targetChainId: number) => {
        const connector = activeConnector ?? bitshardConnector;
        if (!connector || connector.id !== 'bitshard') return;
        const provider = (await connector.getProvider()) as BitShardProvider;
        provider.viewWallet(targetChainId);
    }, [activeConnector, bitshardConnector]);

    return (
        <div className="card">
            <h2>1. Connect & switch chain</h2>
            {isConnected ? (
                <>
                    <p>
                        Connected as <span className="mono">{address}</span>
                    </p>
                    <div className="row">
                        {balance && <span className="badge">{balance.formatted} {balance.symbol}</span>}
                        <span className="badge">chainId {chainId}</span>
                    </div>
                    <div className="field" style={{ marginTop: 4 }}>
                        <label>Switch chain</label>
                        <div className="row" style={{ flexWrap: 'wrap' }}>
                            {chains.map((c) => {
                                const active = c.id === chainId;
                                const supported = BITSHARD_SUPPORTED_IDS.has(c.id);
                                return (
                                    <span
                                        key={c.id}
                                        className="chain-pill"
                                        style={{ display: 'inline-flex', alignItems: 'stretch' }}
                                    >
                                        <button
                                            className={active ? 'primary' : 'ghost'}
                                            disabled={isSwitching}
                                            title={supported ? c.name : `${c.name} — not supported by BitShard yet (popup will reject)`}
                                            onClick={() => switchChain({ chainId: c.id })}
                                            style={{
                                                padding: '6px 10px',
                                                fontSize: 12,
                                                borderTopRightRadius: supported ? 0 : undefined,
                                                borderBottomRightRadius: supported ? 0 : undefined
                                            }}
                                        >
                                            {c.name}{!supported ? ' ⚠' : ''}
                                        </button>
                                        {supported && (
                                            <button
                                                className="ghost"
                                                disabled={!isConnected}
                                                title={isConnected ? `View your BitShard wallet on ${c.name}` : 'Connect first to peek at your wallet'}
                                                onClick={() => openViewer(c.id)}
                                                style={{
                                                    padding: '6px 8px',
                                                    fontSize: 12,
                                                    borderTopLeftRadius: 0,
                                                    borderBottomLeftRadius: 0,
                                                    borderLeft: 'none'
                                                }}
                                                aria-label={`Open BitShard wallet on ${c.name}`}
                                            >
                                                <WalletIcon />
                                            </button>
                                        )}
                                    </span>
                                );
                            })}
                        </div>
                        <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                            Click the wallet icon next to a supported chain to open your BitShard wallet on that chain.
                            Switch chain first if you want your subsequent signs/txs to go there.
                        </p>
                        {switchError && <p className="error">{switchError.message}</p>}
                    </div>
                    <div className="row">
                        <button
                            className="ghost"
                            onClick={() => disconnect()}
                            title="Clears this dApp's wagmi session. You'll stay signed in to BitShard — reconnecting skips Keycloak."
                        >
                            Disconnect
                        </button>
                        <button
                            className="ghost"
                            disabled={!isConnected}
                            onClick={() => openViewer(chainId)}
                            title="Opens the BitShard wallet popup where you can fully sign out of BitShard (ends the Keycloak session)."
                        >
                            Sign out of BitShard…
                        </button>
                    </div>
                    <p className="muted" style={{ margin: '4px 0 0', fontSize: 11 }}>
                        Disconnect clears this dApp's session. To fully sign out of BitShard (Keycloak), use Sign out in the wallet popup.
                    </p>
                </>
            ) : (
                <>
                    <p>
                        Click Connect to open a popup to your BitShard wallet. Pick a wallet (Local or MPC),
                        approve the dApp, and you'll see your address + chain here.
                    </p>
                    <div className="row">
                        <button
                            className="primary"
                            disabled={!bitshardConnector || isConnecting}
                            onClick={() => bitshardConnector && connect({ connector: bitshardConnector, chainId: arbitrumSepolia.id })}
                        >
                            {isConnecting ? 'Opening popup…' : 'Connect BitShard'}
                        </button>
                    </div>
                    {connectError && <p className="error">{connectError.message}</p>}
                </>
            )}
        </div>
    );
}

function SignMessageCard() {
    const { isConnected } = useAccount();
    const chainId = useChainId();
    const supported = BITSHARD_SUPPORTED_IDS.has(chainId);
    const [message, setMessage] = useState('Hello from BitShard');
    const { signMessage, data, error, isPending, reset } = useSignMessage();

    return (
        <div className="card">
            <h2>2. Sign a message</h2>
            <p>
                Calls <span className="kbd">personal_sign</span> on the chain currently selected above. The popup picks
                whichever BitShard wallet you authorized (Local signs synchronously; MPC runs the 2-of-3 ceremony).
            </p>
            {!supported && isConnected && (
                <p className="error">
                    The currently selected chain isn't supported by BitShard. The popup will reject this request — switch back
                    to an Arbitrum chain to actually sign.
                </p>
            )}
            <div className="field">
                <label>Message</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="row">
                <button
                    className="primary"
                    disabled={!isConnected || isPending || !message}
                    onClick={() => {
                        reset();
                        signMessage({ message });
                    }}
                >
                    {isPending ? 'Awaiting approval…' : 'Sign message'}
                </button>
            </div>
            {data && (
                <div className="field">
                    <label>Signature</label>
                    <span className="mono">{data}</span>
                </div>
            )}
            {error && <p className="error">{error.message}</p>}
        </div>
    );
}

function SendTransactionCard() {
    const { isConnected, address } = useAccount();
    const chainId = useChainId();
    const supported = BITSHARD_SUPPORTED_IDS.has(chainId);
    const [to, setTo] = useState<string>(DEFAULT_RECIPIENT);
    const [amount, setAmount] = useState<string>(DEFAULT_VALUE);
    const { sendTransaction, data: hash, error, isPending, reset } = useSendTransaction();

    const valid = Boolean(isConnected && to && amount && Number(amount) > 0);
    const explorerBase = chainId === 42161 ? 'https://arbiscan.io'
        : chainId === 42170 ? 'https://nova.arbiscan.io'
        : 'https://sepolia.arbiscan.io';

    return (
        <div className="card">
            <h2>3. Send a transaction</h2>
            <p>
                Calls <span className="kbd">eth_sendTransaction</span> on the active chain. The popup runs the appropriate
                signing flow and broadcasts the tx.
            </p>
            {!supported && isConnected && (
                <p className="error">
                    The currently selected chain isn't supported by BitShard. The popup will reject this request — switch back
                    to an Arbitrum chain to actually send.
                </p>
            )}
            <div className="field">
                <label>Recipient</label>
                <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" />
            </div>
            <div className="field">
                <label>Amount (ETH)</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="row">
                <button
                    className="primary"
                    disabled={!valid || isPending}
                    onClick={() => {
                        reset();
                        sendTransaction({
                            to: to as Hex,
                            value: parseEther(amount || '0'),
                            account: address,
                            chainId
                        });
                    }}
                >
                    {isPending ? 'Awaiting approval…' : `Send ${amount} ETH`}
                </button>
            </div>
            {hash && (
                <div className="field">
                    <label>Transaction hash</label>
                    <span className="mono">
                        <a
                            href={`${explorerBase}/tx/${hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="success"
                        >
                            {hash}
                        </a>
                    </span>
                </div>
            )}
            {error && <p className="error">{error.message}</p>}
        </div>
    );
}
