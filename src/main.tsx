import React from 'react';
import ReactDOM from 'react-dom/client';
import { http, createConfig, WagmiProvider } from 'wagmi';
import { arbitrum, arbitrumNova, arbitrumSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { bitshard } from '@bitshard.io/bitshard-wagmi-connector';

import { App } from './App';
import './styles.css';

const appUrl = (import.meta.env.VITE_BITSHARD_APP_URL as string | undefined) ?? 'http://localhost:3000';

const SUPPORTED_BY_BITSHARD = [arbitrumSepolia, arbitrum, arbitrumNova] as const;

const config = createConfig({
    chains: SUPPORTED_BY_BITSHARD,
    connectors: [
        bitshard({
            appUrl,
            chains: SUPPORTED_BY_BITSHARD
        })
    ],
    transports: {
        [arbitrumSepolia.id]: http(),
        [arbitrum.id]: http(),
        [arbitrumNova.id]: http()
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
