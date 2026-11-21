import {
  ArrowClockwiseIcon,
  CurrencyBtcIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Banner } from "@/components/Banner";
import { WidgetShell } from "@/components/WidgetShell";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

interface CoinInfo {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

const DEFAULT_COINS: Record<string, CoinInfo> = {
  bitcoin: { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 92450, change24h: 3.42 },
  ethereum: { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3410, change24h: -1.15 },
  solana: { id: "solana", symbol: "SOL", name: "Solana", price: 215, change24h: 6.84 },
  binancecoin: { id: "binancecoin", symbol: "BNB", name: "BNB", price: 654, change24h: 0.75 },
  ripple: { id: "ripple", symbol: "XRP", name: "XRP", price: 1.12, change24h: -2.31 },
};

function formatCurrency(price: number, currency: string): string {
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: price < 1 ? 4 : 2,
      maximumFractionDigits: price < 1 ? 4 : 2,
    }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

export function CryptoTickerWidget({ instance, editMode, patchState }: WidgetProps) {
  const cachedPrices = useMemo(() => {
    const raw = instance.state.prices;
    if (raw && typeof raw === "object") {
      return raw as Record<string, CoinInfo>;
    }
    return DEFAULT_COINS;
  }, [instance.state.prices]);

  const [prices, setPrices] = useState<Record<string, CoinInfo>>(cachedPrices);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ msg: string; type: "info" | "warn" } | null>(null);

  const coinSet = (instance.settings.coins as string) || "top3";
  const currency = (instance.settings.currency as string) || "usd";
  const refreshIntervalMin = parseInt((instance.settings.refreshInterval as string) || "3", 10);

  const targetCoinIds = useMemo(() => {
    switch (coinSet) {
      case "top2":
        return ["bitcoin", "ethereum"];
      case "top5":
        return ["bitcoin", "ethereum", "solana", "binancecoin", "ripple"];
      case "top3":
      default:
        return ["bitcoin", "ethereum", "solana"];
    }
  }, [coinSet]);

  const fetchPrices = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setBanner(null);

      const fetchOptions: RequestInit = signal ? { signal } : {};
      const ids = targetCoinIds.join(",");
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${currency}&include_24hr_change=true`;

      try {
        const res = await fetch(url, fetchOptions);
        if (!res.ok) {
          throw new Error(`API returned HTTP ${res.status}`);
        }

        const data = (await res.json()) as Record<string, Record<string, number>>;

        const updated: Record<string, CoinInfo> = { ...prices };
        let hasUpdates = false;

        for (const id of targetCoinIds) {
          const coinData = data[id];
          if (coinData) {
            const price = coinData[currency] ?? updated[id]?.price ?? 0;
            const change24h = coinData[`${currency}_24h_change`] ?? updated[id]?.change24h ?? 0;

            const existing = updated[id] ||
              DEFAULT_COINS[id] || {
                id,
                symbol: id.toUpperCase().slice(0, 4),
                name: id,
                price,
                change24h,
              };

            updated[id] = {
              ...existing,
              price,
              change24h,
            };
            hasUpdates = true;
          }
        }

        if (hasUpdates) {
          setPrices(updated);
          patchState({ prices: updated });
        }
      } catch (err) {
        if (signal?.aborted) return;
        setBanner({
          msg: err instanceof Error ? err.message : "Failed to fetch crypto prices",
          type: "warn",
        });
      } finally {
        setLoading(false);
      }
    },
    [currency, targetCoinIds, patchState, prices],
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const run = async () => {
      await Promise.resolve();
      if (!active) return;
      void fetchPrices(controller.signal);
    };

    void run();

    const intervalMs = Math.max(1, refreshIntervalMin) * 60 * 1000;
    const interval = setInterval(() => {
      if (active) {
        void fetchPrices(controller.signal);
      }
    }, intervalMs);

    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchPrices, refreshIntervalMin]);

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={manifest.name}
      headerActions={
        <button
          type="button"
          onClick={() => void fetchPrices()}
          disabled={loading}
          className="
            flex cursor-pointer items-center justify-center rounded-md
            text-fg-muted transition-colors block-5 inline-5
            hover:bg-surface-raised hover:text-fg
            disabled:opacity-50
          "
          title="Refresh prices"
        >
          <ArrowClockwiseIcon
            className={`block-3 inline-3 ${loading ? "animate-spin" : ""}`}
            weight="bold"
          />
        </button>
      }
    >
      <div className="flex flex-col gap-2 p-1 text-xs block-full inline-full">
        {banner && (
          <Banner
            message={banner.msg}
            type={banner.type}
            actionText="Dismiss"
            onAction={() => setBanner(null)}
          />
        )}

        <div className="flex flex-col gap-1.5 overflow-y-auto block-full">
          {targetCoinIds.map((id) => {
            const coin = prices[id] ||
              DEFAULT_COINS[id] || {
                id,
                symbol: id.toUpperCase().slice(0, 4),
                name: id,
                price: 0,
                change24h: 0,
              };

            const isPositive = coin.change24h >= 0;

            return (
              <div
                key={id}
                className="
                  flex items-center justify-between rounded-lg border
                  border-line/60 bg-surface-raised/40 px-2.5 py-2
                  transition-colors
                  hover:bg-surface-raised
                "
              >
                <div className="flex items-center gap-2">
                  <div className="flex shrink-0 items-center justify-center rounded-full bg-surface p-1 text-accent-500 shadow-xs block-6 inline-6">
                    <CurrencyBtcIcon className="block-3.5 inline-3.5" weight="bold" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xs/tight font-semibold text-fg">{coin.symbol}</span>
                    <span className="font-mono text-3xs/tight text-fg-muted/80">{coin.name}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span className="font-mono text-2xs/tight font-medium text-fg">
                    {formatCurrency(coin.price, currency)}
                  </span>
                  <div
                    className={`
                      flex items-center gap-0.5 font-mono text-3xs/tight font-medium
                      ${isPositive ? "text-emerald-500" : "text-red-500"}
                    `}
                  >
                    {isPositive ? (
                      <TrendUpIcon className="block-2.5 inline-2.5" weight="bold" />
                    ) : (
                      <TrendDownIcon className="block-2.5 inline-2.5" weight="bold" />
                    )}
                    <span>
                      {isPositive ? "+" : ""}
                      {coin.change24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </WidgetShell>
  );
}

const cryptoTickerModule: WidgetModule = {
  manifest,
  component: CryptoTickerWidget,
  defaultSettings: {
    coins: "top3",
    currency: "usd",
    refreshInterval: "3",
  },
  defaultState: {
    prices: DEFAULT_COINS,
  },
};

export default cryptoTickerModule;
