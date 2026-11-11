import { BottomNav } from "./components/BottomNav";
import { Header } from "./components/Header";
import { MechanicChat } from "./components/MechanicChat";
import { ProModal } from "./components/ProModal";
import { CarbTunePage } from "./pages/CarbTunePage";
import { DiagnosePage } from "./pages/DiagnosePage";
import { FuelMixPage } from "./pages/FuelMixPage";
import { GaragePage } from "./pages/GaragePage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { ShopMeterPage } from "./pages/ShopMeterPage";
import { isPrivacyPath } from "./lib/paths";
import { AppStateProvider, useAppState } from "./state";

function TabBody() {
  const { tab } = useAppState();
  return (
    <>
      {tab === "diagnose" && <DiagnosePage />}
      {tab === "carb" && <CarbTunePage />}
      {tab === "fuel" && <FuelMixPage />}
      {tab === "garage" && <GaragePage />}
      {tab === "shop" && <ShopMeterPage />}
    </>
  );
}

function Shell() {
  return (
    <div className="min-h-dvh bg-garage-bg text-neutral-100">
      <Header />
      <main className="mx-auto max-w-lg px-4 pb-40 pt-4">
        <TabBody />
      </main>
      <BottomNav />
      <MechanicChat />
      <ProModal />
    </div>
  );
}

export default function App() {
  if (isPrivacyPath()) {
    return <PrivacyPage />;
  }
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  );
}
