import { useCallback, useEffect, useMemo, useState } from 'react';
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
    useSignTypedData,
    useSwitchChain
} from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { encodeFunctionData, parseUnits, type Hex } from 'viem';

import type { BitShardProvider, BitShardTokenBalance } from '@bitshard.io/bitshard-wagmi-connector';

type Props = {
    appUrl: string;
};

const DEFAULT_RECIPIENT = '0x000000000000000000000000000000000000dEaD';
const DEFAULT_VALUE = '0.0001';
type DemoWalletKind = 'mpc' | 'local';
const ERC20_TRANSFER_ABI = [
    {
        type: 'function',
        name: 'transfer',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }]
    }
] as const;

/**
 * Convert a human ETH decimal string to wei without passing through Number():
 * tiny values (e.g. 0.0000001) become 1e-7 and downstream parsers reject
 * scientific notation when coerced to string.
 */
function ethInputToWei(amount: string): bigint {
    const t = amount.trim();
    if (!/^\d+(\.\d+)?$/.test(t)) {
        throw new Error('Amount must be a positive decimal (e.g. 0.0001). No scientific notation or commas.');
    }
    const [whole, frac = ''] = t.split('.');
    if (whole === '0' && (frac === '' || /^0*$/.test(frac))) {
        throw new Error('Amount must be greater than zero.');
    }
    return parseUnits(t, 18);
}

function tokenDecimals(token: BitShardTokenBalance | undefined): number {
    const parsed = Number(token?.tokenDecimal ?? 18);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 255 ? parsed : 18;
}

// chainIds known to be supported by the BitShard backend today. This is
// purely cosmetic on the demo side - the popup is the source of truth and
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
            <SignTypedDataCard />
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
    const [walletKind, setWalletKind] = useState<DemoWalletKind>();

    const openViewer = useCallback(async (targetChainId: number) => {
        const connector = activeConnector ?? bitshardConnector;
        if (!connector || connector.id !== 'bitshard') return;
        const provider = (await connector.getProvider()) as BitShardProvider;
        provider.viewWallet(targetChainId);
    }, [activeConnector, bitshardConnector]);

    useEffect(() => {
        const connector = activeConnector ?? bitshardConnector;
        if (!connector || connector.id !== 'bitshard') {
            setWalletKind(undefined);
            return;
        }

        let mounted = true;
        let provider: BitShardProvider | null = null;
        const syncWalletKind = (session?: { walletKind?: DemoWalletKind } | null) => {
            if (!mounted) return;
            setWalletKind(session?.walletKind);
        };

        connector.getProvider().then((p) => {
            if (!mounted) return;
            provider = p as BitShardProvider;
            syncWalletKind(provider.getSession() as unknown as { walletKind?: DemoWalletKind } | null);
            provider.on('bitshard:walletChanged', syncWalletKind);
        }).catch(() => {
            syncWalletKind(null);
        });

        return () => {
            mounted = false;
            if (provider) provider.removeListener('bitshard:walletChanged', syncWalletKind);
        };
    }, [activeConnector, bitshardConnector, address]);

    return (
        <div className="card">
            <h2>1. Connect & switch chain</h2>
            {isConnected ? (
                <>
                    <p>
                        Connected as <span className="mono">{address}</span>
                    </p>
                    <div className="row">
                        {walletKind && <span className="badge">{walletKind === 'mpc' ? 'MPC wallet' : 'Local wallet'}</span>}
                        {balance && <span className="badge">{balance.formatted} {balance.symbol}</span>}
                        <span className="badge">chainId {chainId}</span>
                    </div>
                    <div className="field" style={{ marginTop: 4 }}>
                        <label>Switch chain</label>
                        <div className="chain-select-row">
                            <select
                                value={chainId}
                                disabled={isSwitching}
                                onChange={(event) => switchChain({ chainId: Number(event.target.value) })}
                                aria-label="Select Arbitrum chain"
                            >
                                {chains.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                className="ghost icon-btn"
                                disabled={!isConnected}
                                title="Open your BitShard wallet on the selected chain"
                                onClick={() => openViewer(chainId)}
                                aria-label="Open BitShard wallet"
                            >
                                <WalletIcon />
                            </button>
                        </div>
                        <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                            Select the Arbitrum chain for subsequent signs/transactions, or open your BitShard wallet with the icon.
                        </p>
                        {switchError && <p className="error">{switchError.message}</p>}
                    </div>
                    <div className="row">
                        <button
                            className="ghost"
                            onClick={() => disconnect()}
                            title="Clears this dApp's wagmi session."
                        >
                            Disconnect
                        </button>
                    </div>
                    <p className="muted" style={{ margin: '4px 0 0', fontSize: 11 }}>
                        Disconnect clears this dApp's wagmi session.
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
                    The currently selected chain isn't supported by BitShard. The popup will reject this request - switch back
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
    const connections = useConnections();
    const [to, setTo] = useState<string>(DEFAULT_RECIPIENT);
    const [amount, setAmount] = useState<string>(DEFAULT_VALUE);
    const [tokenTo, setTokenTo] = useState<string>(DEFAULT_RECIPIENT);
    const [tokenAmount, setTokenAmount] = useState<string>('1');
    const [tokens, setTokens] = useState<BitShardTokenBalance[]>([]);
    const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>('');
    const [tokenLoadError, setTokenLoadError] = useState<string | null>(null);
    const [isLoadingTokens, setIsLoadingTokens] = useState(false);
    const { sendTransaction, data: hash, error, isPending, reset } = useSendTransaction();
    const activeConnector = connections[0]?.connector;

    useEffect(() => {
        setTokens([]);
        setSelectedTokenAddress('');
        setTokenLoadError(null);
    }, [chainId, address]);

    let amountError: string | null = null;
    try {
        if (amount.trim()) ethInputToWei(amount);
    } catch (e) {
        amountError = e instanceof Error ? e.message : 'Invalid amount';
    }
    const valid = Boolean(isConnected && to && amount && !amountError);
    const explorerBase = chainId === 42161 ? 'https://arbiscan.io'
        : chainId === 42170 ? 'https://nova.arbiscan.io'
        : 'https://sepolia.arbiscan.io';
    const selectedToken = tokens.find((t) => t.contractAddress?.toLowerCase() === selectedTokenAddress.toLowerCase());
    const selectedTokenSymbol = selectedToken?.tokenSymbol || 'token';
    let tokenAmountError: string | null = null;
    try {
        if (tokenAmount.trim()) parseUnits(tokenAmount, tokenDecimals(selectedToken));
    } catch (e) {
        tokenAmountError = e instanceof Error ? e.message : 'Invalid token amount';
    }
    const tokenValid = Boolean(isConnected && selectedToken?.contractAddress && tokenTo && tokenAmount && !tokenAmountError);

    const loadTokens = useCallback(async () => {
        if (!activeConnector || activeConnector.id !== 'bitshard') return;
        setIsLoadingTokens(true);
        setTokenLoadError(null);
        try {
            const provider = (await activeConnector.getProvider()) as BitShardProvider;
            const payload = await provider.getTokens(chainId);
            const erc20s = payload.tokens || [];
            setTokens(erc20s);
            setSelectedTokenAddress((current) => current || erc20s[0]?.contractAddress || '');
        } catch (e) {
            setTokenLoadError(e instanceof Error ? e.message : 'Failed to load token balances');
        } finally {
            setIsLoadingTokens(false);
        }
    }, [activeConnector, chainId]);

    return (
        <div className="card">
            <h2>4. Send a transaction</h2>
            <p>
                Calls <span className="kbd">eth_sendTransaction</span> on the active chain. The popup runs the appropriate
                signing flow and broadcasts the tx.
            </p>
            {!supported && isConnected && (
                <p className="error">
                    The currently selected chain isn't supported by BitShard. The popup will reject this request - switch back
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
            {amountError && <p className="error">{amountError}</p>}
            <div className="row">
                <button
                    className="primary"
                    disabled={!valid || isPending}
                    onClick={() => {
                        reset();
                        let value: bigint;
                        try {
                            value = ethInputToWei(amount || '0');
                        } catch (e) {
                            console.error(e);
                            return;
                        }
                        sendTransaction({
                            to: to as Hex,
                            value,
                            account: address,
                            chainId
                        });
                    }}
                >
                    {isPending ? 'Awaiting approval…' : `Send ${amount} ETH`}
                </button>
            </div>
            <div className="divider" />
            <h3>Send ERC-20 token</h3>
            <p>
                Loads ERC-20 balances through <span className="kbd">provider.getTokens(chainId)</span>, then sends a standard
                <span className="kbd">transfer</span> transaction through the same BitShard signing flow.
            </p>
            <div className="row">
                <button
                    className="ghost"
                    disabled={!isConnected || !supported || isLoadingTokens}
                    onClick={loadTokens}
                >
                    {isLoadingTokens ? 'Loading tokens…' : 'Load wallet tokens'}
                </button>
            </div>
            {tokens.length > 0 && (
                <>
                    <div className="field">
                        <label>Token</label>
                        <select
                            value={selectedTokenAddress}
                            onChange={(e) => setSelectedTokenAddress(e.target.value)}
                        >
                            {tokens.map((token) => (
                                <option key={token.contractAddress} value={token.contractAddress}>
                                    {token.tokenSymbol || 'TOKEN'} · {token.balance || '0'}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="field">
                        <label>Recipient</label>
                        <input value={tokenTo} onChange={(e) => setTokenTo(e.target.value)} placeholder="0x…" />
                    </div>
                    <div className="field">
                        <label>Amount ({selectedTokenSymbol})</label>
                        <input value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} />
                    </div>
                    {tokenAmountError && <p className="error">{tokenAmountError}</p>}
                    <div className="row">
                        <button
                            className="primary"
                            disabled={!tokenValid || isPending}
                            onClick={() => {
                                if (!selectedToken?.contractAddress) return;
                                reset();
                                let data: Hex;
                                try {
                                    data = encodeFunctionData({
                                        abi: ERC20_TRANSFER_ABI,
                                        functionName: 'transfer',
                                        args: [tokenTo as Hex, parseUnits(tokenAmount || '0', tokenDecimals(selectedToken))]
                                    });
                                } catch (e) {
                                    console.error(e);
                                    return;
                                }
                                sendTransaction({
                                    to: selectedToken.contractAddress,
                                    data,
                                    value: 0n,
                                    account: address,
                                    chainId
                                });
                            }}
                        >
                            {isPending ? 'Awaiting approval…' : `Send ${tokenAmount} ${selectedTokenSymbol}`}
                        </button>
                    </div>
                </>
            )}
            {!isLoadingTokens && tokens.length === 0 && tokenLoadError === null && isConnected && (
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                    Click Load wallet tokens to fetch ERC-20 balances for the selected BitShard wallet.
                </p>
            )}
            {tokenLoadError && <p className="error">{tokenLoadError}</p>}
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

function SignTypedDataCard() {
    const { isConnected } = useAccount();
    const chainId = useChainId();
    const supported = BITSHARD_SUPPORTED_IDS.has(chainId);
    const { signTypedData, data, error, isPending, reset } = useSignTypedData();

    const domain = {
        name: 'BitShard Demo',
        version: '1',
        chainId,
        verifyingContract: '0x000000000000000000000000000000000000dEaD' as Hex
    };
    const types = {
        DemoMessage: [
            { name: 'contents', type: 'string' },
            { name: 'from', type: 'address' }
        ]
    };
    const message = {
        contents: 'Hello typed data from BitShard',
        from: '0x000000000000000000000000000000000000dEaD' as Hex
    };

    return (
        <div className="card">
            <h2>3. Sign typed data</h2>
            <p>
                Calls <span className="kbd">eth_signTypedData_v4</span>. The popup hashes the EIP-712 payload and the MPC
                parties sign the digest.
            </p>
            {!supported && isConnected && (
                <p className="error">
                    The currently selected chain isn't supported by BitShard. Switch back to an Arbitrum chain to sign.
                </p>
            )}
            <div className="field">
                <label>Typed data preview</label>
                <span className="mono">{JSON.stringify({ domain, types, primaryType: 'DemoMessage', message }, null, 2)}</span>
            </div>
            <div className="row">
                <button
                    className="primary"
                    disabled={!isConnected || isPending || !supported}
                    onClick={() => {
                        reset();
                        signTypedData({
                            domain,
                            types,
                            primaryType: 'DemoMessage',
                            message
                        });
                    }}
                >
                    {isPending ? 'Awaiting approval…' : 'Sign typed data'}
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
