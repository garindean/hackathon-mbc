import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { coinbaseWallet, metaMask, injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: "EdgeFinder",
      appLogoUrl: "https://edgefinder.app/logo.png",
    }),
    metaMask(),
    injected(),
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
});

export { baseSepolia };
