import React from 'react';
import ReactDOM from 'react-dom/client';
import { http, createConfig, WagmiProvider } from 'wagmi';
import { arbitrum, arbitrumNova, arbitrumSepolia, mainnet } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { bitshard } from '@bitshard.io/bitshard-wagmi-connector';

import { App } from './App';
import './styles.css';

const appUrl = (import.meta.env.VITE_BITSHARD_APP_URL as string | undefined) ?? 'http://localhost:3000';

// We deliberately enable both BitShard-supported chains (Arbitrum One,
// Arbitrum Nova, Arbitrum Sepolia) AND Ethereum mainnet so that switching
// to mainnet exercises the connector's "unsupported chain" UX. The bridge
// popup will reject mainnet with a clear message because the BitShard
// backend doesn't currently sign for it.
const SUPPORTED_BY_BITSHARD = [arbitrumSepolia, arbitrum, arbitrumNova] as const;
const ALL_CHAINS = [arbitrumSepolia, arbitrum, arbitrumNova, mainnet] as const;

const config = createConfig({
    chains: ALL_CHAINS,
    connectors: [
        bitshard({
            appUrl,
            // Tell the connector which chains BitShard supports — this lets
            // the connector accept switches to those at the wagmi layer
            // without emitting an immediate 4902. Mainnet is intentionally
            // omitted here, but switching from the dApp UI will still send
            // the request to the popup; the popup is the source of truth.
            chains: SUPPORTED_BY_BITSHARD as unknown as typeof ALL_CHAINS
        })
    ],
    transports: {
        [arbitrumSepolia.id]: http(),
        [arbitrum.id]: http(),
        [arbitrumNova.id]: http(),
        [mainnet.id]: http()
    }
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <App appUrl={appUrl} />
            </QueryClientProvider>
        </WagmiProvider>
    </React.StrictMode>
);
