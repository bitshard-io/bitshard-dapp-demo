# BitShard demo dApp

A minimal wagmi v2 + React dApp that demonstrates [`@bitshard.io/bitshard-wagmi-connector`](https://www.npmjs.com/package/@bitshard.io/bitshard-wagmi-connector) on Arbitrum Sepolia.

This repository is the **standalone** version of the demo that used to live under `examples/demo-dapp/` in the main BitShard monorepo. Everything here is self-contained — dependencies resolve from npm, not a sibling folder.

It exposes four flows:

1. **Connect** — opens the BitShard popup, lets you authorize the dApp, returns your MPC wallet address.
2. **Sign message** — calls `personal_sign` through the connector.
3. **Sign typed data** — calls `eth_signTypedData_v4` through the connector.
4. **Send transaction** — sends `0.0001 ETH` on Arbitrum Sepolia via `eth_sendTransaction`, broadcasts through the BitShard backend, and renders an Arbiscan link to the mined hash.

## Local development

The demo depends on the BitShard wallet app hosting the popup bridge at `${appUrl}/connector` (for example, [`https://wallet.bitshard.io`](https://wallet.bitshard.io) in production or `http://localhost:3000` when running the wallet stack locally).

1. Start the BitShard wallet app (frontend + backend) on `http://localhost:3000`:

   ```bash
   # from the bitshard monorepo root
   npm run dev          # frontend on :3000
   cd backend && npm run dev   # backend on :5000
   ```

2. Make sure the dApp origin is on the allowlist. In the BitShard backend `.env` set:

   ```
   DAPP_ORIGIN_ALLOWLIST=http://localhost:5174
   ```

   Local development also adds `http://localhost:5174` by default, so this is only needed for production.

3. Install and run **this** repo:

   ```bash
   cp .env.example .env
   npm install
   npm run dev
   ```

   Install pulls the connector from npm — [`@bitshard.io/bitshard-wagmi-connector`](https://www.npmjs.com/package/@bitshard.io/bitshard-wagmi-connector).

   The demo runs on <http://localhost:5174>.

4. In the demo, click **Connect BitShard**. A popup opens pointed at `http://localhost:3000/connector?action=connect`. Sign into BitShard (you must already have an MPC or local wallet) and authorize the dApp — the popup closes and your address appears in the dApp.

## Docker

From this directory:

```bash
docker build -f Dockerfile -t bitshard/demo-dapp:latest .
docker run --rm -p 5174:5174 bitshard/demo-dapp:latest
```

## Build & deploy (Vercel)

```bash
npm run build
```

The static output in `dist/` can be deployed to any static host. For Vercel:

```bash
npx vercel deploy --prod
```

Set `VITE_BITSHARD_APP_URL=https://wallet.bitshard.io` on the deployment environment. Don't forget to add the dApp's final origin to `DAPP_ORIGIN_ALLOWLIST` on the BitShard backend.

## Project layout

```
bitshard-dapp-demo/
├── index.html
├── package.json
├── src/
│   ├── App.tsx         # UI
│   ├── main.tsx        # wagmi config
│   └── styles.css
└── vite.config.ts
```

## Notes

- Read-only RPC calls (`eth_getBalance`, `eth_call`, …) are handled by the connector via a `viem` public client — no popup needed.
- Only the three mutating methods (`eth_requestAccounts`, `personal_sign`/`eth_signTypedData_v4`, `eth_sendTransaction`) open the popup.
- Session state is persisted in `localStorage` under `bitshard.wagmi.session`. Wagmi's `reconnect` hydrates silently without re-opening the popup.
