import { Fuel, Gauge, Stethoscope, Warehouse, Wrench } from "lucide-react";
import { useAppState, type TabId } from "../state";

const ITEMS: { id: TabId; label: string; icon: typeof Fuel }[] = [
  { id: "diagnose", label: "Diagnose", icon: Stethoscope },
  { id: "carb", label: "Carb & Tune", icon: Wrench },
  { id: "fuel", label: "Fuel Mix", icon: Fuel },
  { id: "garage", label: "My Garage", icon: Warehouse },
  { id: "shop", label: "Shop Meter", icon: Gauge },
];

export function BottomNav() {
  const { tab, setTab } = useAppState();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0c0c0c]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const on = tab === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-semibold leading-tight ${
                  on ? "text-garage-orange" : "text-neutral-400"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="text-center">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
