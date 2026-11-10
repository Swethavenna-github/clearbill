"use client";

// The AG Studio report (the sponsor's dashboard tool) over the clinic's live PayPal sandbox data:
// invoices, EMI plans, payments and balances. Based on the PayPal + AG Grid starter project.
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import type { DashboardData } from "@/lib/dashboard-data";
import { buildStudioData, hasData } from "./studio/data";
import { dashboardReport } from "./studio/initial-report";
import { agStudioPayPalTheme } from "./studio/theme";

export function StudioView({ data, licenseKey }: { data: DashboardData; licenseKey?: string }) {
  if (!hasData(data)) {
    return <div className="panel">No PayPal data yet. Create an invoice or a payment plan in the patient app, then reload.</div>;
  }
  return (
    <div style={{ height: "calc(100vh - 120px)", minHeight: 520 }}>
      <AgStudioProvider licenseKey={licenseKey}>
        <AgStudio
          style={{ height: "100%", width: "100%" }}
          theme={agStudioPayPalTheme}
          layout={{ widgetBorderEnabled: true }}
          data={buildStudioData(data)}
          initialState={dashboardReport}
          mode="view"
        />
      </AgStudioProvider>
    </div>
  );
}
