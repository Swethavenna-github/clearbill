"use client";

// Two AG Studio widgets (the sponsor's dashboard tool) for the clinic overview: unpaid balances by days
// past due, and billed vs collected by month. The aging rows come live from /api/clinic; the monthly
// trend is fictional sample data.
import { useEffect, useRef, useState } from "react";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import type { AgDataSourcesDefinition, AgReportState } from "ag-studio";
import { agStudioPayPalTheme } from "./billing/studio/theme";

export type Bucket = { label: string; amount: number };

const TREND = [
  { month: "Jun", order: 1, billed: 6200, collected: 3100 },
  { month: "Jul", order: 2, billed: 7400, collected: 4300 },
  { month: "Aug", order: 3, billed: 8100, collected: 5600 },
  { month: "Sep", order: 4, billed: 9300, collected: 6900 },
  { month: "Oct", order: 5, billed: 10200, collected: 8400 },
  { month: "Nov", order: 6, billed: 11100, collected: 9700 },
];

const title = (text: string) => ({ title: { enabled: true, text } });

const report: AgReportState = {
  selectedPageId: "overview",
  pages: [
    {
      id: "overview",
      widgets: {
        aging: {
          type: "bar-chart-grouped",
          dataMapping: {
            categoryKey: [{ id: "aging.label" }],
            valueKey: [{ id: "aging.amount", aggregation: "sum" }],
          },
          sort: [{ field: { id: "aging.order", aggregation: "min" }, direction: "desc" }],
          format: title("Unpaid balances by days past due"),
        },
        trend: {
          type: "line-chart",
          dataMapping: {
            categoryKey: [{ id: "trend.month" }],
            valueKey: [
              { id: "trend.billed", aggregation: "sum" },
              { id: "trend.collected", aggregation: "sum" },
            ],
          },
          format: {
            ...title("Billed vs collected, last 6 months (sample data)"),
            style: { theme: { common: { legend: { enabled: true } } } },
          },
        },
      },
      widgetLayout: {
        aging: { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 21 },
        trend: { xTrack: 12, yTrack: 0, xSpan: 12, ySpan: 21 },
      },
    },
  ],
} as AgReportState;

export function ClinicStudio({ buckets, licenseKey }: { buckets: Bucket[]; licenseKey?: string }) {
  const data: AgDataSourcesDefinition = {
    description: "A clinic's payment-plan balances by how many days past due they are, and billed vs collected money by month.",
    sources: [
      {
        id: "aging",
        name: "Unpaid balances",
        data: buckets.map((b, i) => ({ label: b.label, order: i + 1, amount: b.amount })),
        fields: [
          { id: "label", name: "Days past due", format: "textFormat" },
          { id: "order", name: "Order", format: "integerFormat", hide: true },
          { id: "amount", name: "Unpaid balance", format: "currencyFormat" },
        ],
      },
      {
        id: "trend",
        name: "Monthly trend",
        data: TREND,
        fields: [
          { id: "month", name: "Month", format: "textFormat" },
          { id: "order", name: "Order", format: "integerFormat", hide: true },
          { id: "billed", name: "Billed", format: "currencyFormat" },
          { id: "collected", name: "Collected", format: "currencyFormat" },
        ],
      },
    ],
  } as AgDataSourcesDefinition;
  // Studio sizes itself from pixel values, so measure the box it sits in and pass them down.
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.floor(el.clientWidth)));
    ro.observe(el);
    setW(Math.floor(el.clientWidth));
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="cb-studio" style={{ height: 380, width: "100%", minWidth: 0, position: "relative" }}>
      {w > 0 && (
      <AgStudioProvider licenseKey={licenseKey}>
        <AgStudio style={{ height: "100%", width: "100%" }} theme={agStudioPayPalTheme} layout={{ widgetBorderEnabled: true }} data={data} initialState={report} mode="view" panels={{ view: { left: [], right: [] } }} />
      </AgStudioProvider>
      )}
    </div>
  );
}
