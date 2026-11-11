import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { SHARE_CONSENT } from "../components/ShareFixButton";

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
});

async function openTab(label: string) {
  const nav = screen.getByRole("navigation", { name: "Main" });
  await userEvent.click(within(nav).getByRole("button", { name: label }));
}

describe("CrankIt app", () => {
  it("renders the diagnose tab and walks a full tree, including Tree 4 branching", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Diagnose" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Chainsaw" }));
    expect(screen.getByText(/What's it doing/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(6);

    await userEvent.click(screen.getByRole("button", { name: /Won't start at all/i }));
    expect(screen.getByText(/1\/2-teaspoon mix wet test/i)).toBeInTheDocument();
    expect(screen.getByText(/Fire safety/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /It fired \/ ran for 2 seconds/i }));
    expect(screen.getByText(/Spark and compression are good/i)).toBeInTheDocument();
    expect(screen.getByText(/do not take this to a shop/i)).toBeInTheDocument();
  });

  it("has working Carb, Fuel, Garage, and Shop tabs with no missing controls", async () => {
    render(<App />);

    await openTab("Carb & Tune");
    expect(screen.getByRole("heading", { name: "Carb & Tune" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Listen to My Engine \(Live RPM & Tune Check\)/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /Test Without Mic/i }));
    expect(screen.getByText(/Simulated RPM/i)).toBeInTheDocument();
    expect(screen.getByText(/Idle Locked In/i)).toBeInTheDocument();
    expect(screen.getByText(/audio is analyzed in the browser and is never recorded/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Bogs at full throttle" }));
    expect(screen.getAllByText(/1\/8 turn counter-clockwise/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Screw-head identifier/i)).toBeInTheDocument();
    expect(screen.getByText(/Double-D/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Universal carb adjustment tool kit/i })).toHaveAttribute(
      "href",
      expect.stringContaining("amazon.com"),
    );

    await openTab("Fuel Mix");
    await userEvent.click(screen.getByRole("button", { name: "2.5 Gal" }));
    await userEvent.click(screen.getByRole("button", { name: /50:1/i }));
    expect(screen.getByText("6.4")).toBeInTheDocument(); // 2.5 * 2.56 oz
    await userEvent.click(screen.getByRole("button", { name: /Log new mixed gas batch/i }));
    expect(screen.getAllByText(/2\.5 gal/i).length).toBeGreaterThan(0);

    await openTab("My Garage");
    await userEvent.click(screen.getByRole("button", { name: /Load sample fleet/i }));
    expect(screen.getByRole("heading", { name: "Chainsaw #1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Weed Eater #4" })).toBeInTheDocument();

    await openTab("Shop Meter");
    const yesButtons = screen.getAllByRole("button", { name: "Yes" });
    expect(yesButtons.length).toBeGreaterThanOrEqual(3);
    for (const b of yesButtons) await userEvent.click(b);
    expect(screen.getByText(/DO NOT TAKE THIS TO A SHOP/i)).toBeInTheDocument();
    expect(screen.queryByText(/Local repair shop/i)).not.toBeInTheDocument();
  });

  it("opens the Ask Mechanic drawer, greets from the garage, and answers a quick-tap chip", async () => {
    const fleet = [
      {
        id: "t1",
        name: "Chainsaw #1",
        toolType: "chainsaw",
        brandModel: "",
        mixRatio: "50:1",
        sparkPlugType: "",
        chainFileSize: "n/a",
        lastTuneDate: "",
        repairNotes: "",
        createdAt: "2026-11-11T00:00:00.000Z",
      },
    ];
    localStorage.setItem("crankit.garageTools", JSON.stringify(fleet));
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Ask Mechanic" }));
    expect(screen.getByRole("dialog", { name: /Master 2-Stroke Mechanic AI/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Chainsaw #1/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Dies when I tilt it sideways" }));
    expect(await screen.findByText(/\$3–\$5 driveway fix/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "That fixed it" }));
    expect(screen.getByRole("button", { name: "That fixed it" })).toBeDisabled();
    const share = screen.getByRole("button", { name: "Share this fix with CrankIt" });
    await userEvent.click(share);
    expect(screen.getByText(SHARE_CONSENT)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Teach the mechanic" }));
    await userEvent.type(screen.getByPlaceholderText(/Dies when I tilt it/i), "Bogs when I give it gas");
    await userEvent.type(screen.getByPlaceholderText(/Replaced the in-tank fuel line/i), "Opened the L screw a hair");
    await userEvent.click(screen.getByRole("button", { name: "Save tip" }));
    expect(screen.getByText(/Saved\. The mechanic will mention this tip/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Share this fix with CrankIt" }).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Reset learning" }));
    expect(screen.getByText(/Driveway learning on this device was cleared/i)).toBeInTheDocument();
  });

  it("tailors a mechanic answer to a garage tool brand and shows official brand notes in My Garage", async () => {
    const fleet = [
      {
        id: "t1",
        name: "MS 170",
        toolType: "chainsaw",
        brand: "stihl",
        brandModel: "MS 170",
        mixRatio: "50:1",
        sparkPlugType: "",
        chainFileSize: "5/32\"",
        lastTuneDate: "",
        repairNotes: "",
        createdAt: "2026-11-11T00:00:00.000Z",
      },
    ];
    localStorage.setItem("crankit.garageTools", JSON.stringify(fleet));
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Ask Mechanic" }));
    await userEvent.click(screen.getByRole("button", { name: "Put wrong oil / old gas in it" }));
    expect(await screen.findByText(/For a STIHL/i)).toBeInTheDocument();
    expect(screen.getByText(/check the manufacturer/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close mechanic chat" }));
    await openTab("My Garage");
    expect(screen.getByRole("heading", { name: "Brand notes" })).toBeInTheDocument();
    expect(screen.getAllByText(/Craftsman/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/typical published figures — check your manual/i).length).toBeGreaterThan(0);
  });

  it("offers Share this fix after FIXED IT and opens a prefilled anonymous mailto", async () => {
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.href);
    });
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Chainsaw" }));
    await userEvent.click(screen.getByRole("button", { name: /Won't start at all/i }));
    await userEvent.click(screen.getByRole("button", { name: /FIXED IT/i }));
    expect(screen.getByRole("button", { name: "Share this fix with CrankIt" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Share this fix with CrankIt" }));
    expect(screen.getByText(SHARE_CONSENT)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm share" }));
    expect(await screen.findByText(/Your email app should open with the anonymous fields/i)).toBeInTheDocument();
    expect(clicks.some((h) => h.includes("mailto:waltinvents@agentmail.to"))).toBe(true);
    const opened = decodeURIComponent(clicks.find((h) => h.includes("mailto:")) ?? "");
    expect(opened).toContain("worked: yes");
    expect(opened).toContain("toolType: chainsaw");
  });

  it("renders the privacy page at /crankit/privacy", () => {
    window.history.pushState({}, "", "/crankit/privacy");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Privacy" })).toBeInTheDocument();
    expect(screen.getByText(/opt-in anonymous sharing/i)).toBeInTheDocument();
    expect(screen.getByText(/sender address on that email will be visible/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to CrankIt/i })).toHaveAttribute("href", "/crankit/");
    window.history.pushState({}, "", "/crankit/");
  });

  it("offers live Stripe checkout and an honor-system unlock after payment", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Get Pro" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const pay = screen.getByRole("link", { name: /Unlock Pro/i });
    expect(pay).toHaveAttribute("href", "https://buy.stripe.com/14A6oH1tibkAcKP5bE1Fe00");
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /I paid — unlock this device/i }));
    expect(screen.getByText(/Pro unlocked on this device/i)).toBeInTheDocument();
    expect(localStorage.getItem("crankit.proUnlocked")).toBe("1");
  });
});
