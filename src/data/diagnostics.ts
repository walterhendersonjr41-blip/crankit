import type { PartId } from "../config/monetization";
import { LIMITER_NOTE, STAMPED_LETTER_NOTE } from "./carbNotes";

export type ToolType = "chainsaw" | "weed-eater" | "leaf-blower" | "hedge-trimmer" | "lawn-mower" | "generator" | "pressure-washer";

export const TOOL_TYPES: { id: ToolType; label: string }[] = [
  { id: "chainsaw", label: "Chainsaw" },
  { id: "weed-eater", label: "Weed Eater" },
  { id: "leaf-blower", label: "Leaf Blower" },
  { id: "hedge-trimmer", label: "Hedge Trimmer" },
  { id: "lawn-mower", label: "Lawn Mower" },
  { id: "generator", label: "Generator" },
  { id: "pressure-washer", label: "Pressure Washer" },
];

export type BadgeKind = "diy" | "part" | "shop";

export type BranchAction =
  | { type: "continue" }
  | { type: "end-diy"; title: string; body: string; nextHint?: string };

export type BranchOption = {
  id: string;
  label: string;
  action: BranchAction;
};

export type DiagStep = {
  id: string;
  title: string;
  costLabel: string;
  timeLabel: string;
  badge: BadgeKind;
  body: string;
  safety?: string;
  letterCheck?: boolean;
  parts?: PartId[];
  branch?: {
    prompt: string;
    options: BranchOption[];
  };
};

export type DiagTree = {
  id: string;
  title: string;
  shortTitle: string;
  summary: string;
  steps: DiagStep[];
};

const MUFFLER_HOT =
  "Mufflers and spark-arrestor screens get extremely hot. Let the engine cool before you touch them. Wear eye protection.";

const TORCH_SAFETY =
  "If you burn carbon off the screen, do it outdoors, away from fuel, dry grass, and buildings. Use a lighter or a small torch, hold the screen with pliers (not your fingers), and keep a fire extinguisher or hose nearby. Let the screen cool completely before reinstalling. Never wave an open flame near the fuel tank or a spilled mix.";

const WET_TEST_FIRE =
  "Fire safety: do this outdoors only, away from sparks, cigarettes, pilot lights, and open flames. Keep a fire extinguisher handy. Use just 1/2 teaspoon of mixed fuel — do not pour freely. Wipe any spill off the engine before you pull the cord. If fuel has spilled on your clothes, change them first.";

const CLUTCH_SAFETY =
  "Let the tool cool. Disconnect the spark-plug wire and park it where it cannot spring back onto the plug before you work on a chain, bar, clutch, or trimmer head. Engage the chain brake on a saw. Wear gloves and eye protection.";

export const TREES: DiagTree[] = [
  {
    id: "intermittent-start",
    title: "Cranks one day, won't crank the next (Intermittent Start)",
    shortTitle: "Intermittent start",
    summary: "Runs sometimes, then refuses. Start with the free electrical and fuel checks.",
    steps: [
      {
        id: "t1-s1",
        title: "Check the kill switch & flooding",
        costLabel: "$0",
        timeLabel: "2 mins",
        badge: "diy",
        body:
          "Verify the ignition switch is ON (not in the stop/stop-symbol position). If you already pulled more than 6 times on full choke, the cylinder may be flooded. Remove the spark plug, turn the switch OFF, pull the cord 8 times to clear the flooded cylinder, dry the plug, reinstall it, and pull with the choke OFF.",
      },
      {
        id: "t1-s2",
        title: "Spark plug wire & boot check",
        costLabel: "$0–$4",
        timeLabel: "3 mins",
        badge: "diy",
        body:
          "Pull the rubber boot off the spark plug. Inspect the metal spring clip inside the boot for corrosion or a loose fit on the plug tip. Inspect the wire insulation for cracks or rubbing against the metal housing (that grounds the spark out). Re-seat the boot firmly until it clicks.",
        parts: ["spark-plug-wire-boot"],
      },
      {
        id: "t1-s3",
        title: "Bad ethanol gas flush",
        costLabel: "$0",
        timeLabel: "5 mins",
        badge: "diy",
        body:
          "Dump the tank fuel into a clear glass jar. Look for water separating at the bottom or a dark, varnish smell. Flush the tank and run fresh ethanol-free 91/93 octane mixed at the ratio your tool calls for (often 50:1). Use the Fuel Mix tab to measure oil exactly.",
        safety:
          "Pour fuel outdoors, away from sparks and flames. Wipe spills. Dispose of stale mix legally — a small amount of mixed gas can usually be diluted into a car’s gasoline tank if the mix is still gasoline (not varnish).",
        parts: ["two-cycle-oil", "fuel-stabilizer"],
      },
      {
        id: "t1-s4",
        title: "Stiff carburetor metering diaphragm",
        costLabel: "$6",
        timeLabel: "10 mins",
        badge: "part",
        body:
          "Remove the 4 screws on the top or bottom carb cover (you often do not need to unbolt the carb from the engine if the cover is accessible). Touch the black rubber diaphragm — if it crinkles like stiff paper instead of flexing like soft rubber, replace just the diaphragm/gasket kit.",
        parts: ["carb-diaphragm-kit"],
      },
      {
        id: "t1-s5",
        title: "Failing ignition coil (heat-soak failure)",
        costLabel: "$18",
        timeLabel: "20 mins",
        badge: "part",
        body:
          "If spark is strong when the engine is cold but disappears when it is warm, the ignition coil is a common heat-soak failure. Replace the coil and set the gap to 0.012\" (about the thickness of a business card) from the flywheel. Confirm the gap in your model’s manual if it lists a different figure.",
        parts: ["ignition-coil"],
      },
    ],
  },
  {
    id: "bogs-on-accel",
    title: "Starts on choke, dies immediately when trigger is squeezed (Bogs on Acceleration)",
    shortTitle: "Bogs on acceleration",
    summary: "Fires on choke, then falls on its face when you give it throttle.",
    steps: [
      {
        id: "t2-s1",
        title: "Adjust the L (low-speed) carburetor screw",
        costLabel: "$0",
        timeLabel: "2 mins",
        badge: "diy",
        letterCheck: true,
        body:
          STAMPED_LETTER_NOTE +
          " Find the L (low-speed) mixture screw. Turn it COUNTER-CLOCKWISE by 1/8 to 1/4 turn to richen low-end fuel delivery. Snap the throttle and listen. " +
          LIMITER_NOTE,
        parts: ["carb-adjustment-tool"],
      },
      {
        id: "t2-s2",
        title: "Clogged muffler spark-arrestor screen",
        costLabel: "$0",
        timeLabel: "5 mins",
        badge: "diy",
        body:
          "Remove the screw holding the muffler exhaust screen. If it is coated in black carbon soot (especially from cheap oil or 4-stroke oil), you can brush it with a wire brush. If the carbon is baked on, burn it clean carefully with a propane torch or lighter, then brush again.",
        safety: `${MUFFLER_HOT} ${TORCH_SAFETY}`,
        parts: ["spark-arrestor-screen"],
      },
      {
        id: "t2-s3",
        title: "Clogged in-tank felt fuel filter",
        costLabel: "$3",
        timeLabel: "5 mins",
        badge: "diy",
        body:
          "Fish the fuel line out of the tank with a bent wire hook. Pull off the felt or weighted filter and blow through it — if it is restricted, replace it (about a $3 part).",
        safety: "Work away from sparks and flames. Wipe spilled fuel before you pull the rope again.",
        parts: ["in-tank-fuel-filter"],
      },
      {
        id: "t2-s4",
        title: "Pinched or cracked fuel line / air leak",
        costLabel: "$6",
        timeLabel: "10 mins",
        badge: "part",
        body:
          "Inspect the fuel lines from the tank to the carb for tiny cracks that suck air under throttle, or for a pinch behind the tank. Replace with proper Tygon (or equivalent) small-engine fuel line.",
        parts: ["tygon-fuel-line"],
      },
    ],
  },
  {
    id: "bogs-under-load",
    title: "Bogs down / loses power under heavy load (in thick wood or tall grass)",
    shortTitle: "Bogs under load",
    summary: "Idles and revs in the air, then falls on its face when the work gets hard.",
    steps: [
      {
        id: "t3-s1",
        title: "Air filter & chain/head drag check",
        costLabel: "$0",
        timeLabel: "3 mins",
        badge: "diy",
        body:
          "Remove the air filter — if it is soaked in oil or sawdust, clean it or test briefly with the cover off (do not run long without a filter). For chainsaws: verify the chain is sharp (it should throw thick chips, not fine dust) and that the chain brake is not dragging. For trimmers: make sure the head isn’t packed with wrapped grass.",
        safety:
          "Disconnect the spark-plug wire before you put a hand near a chain or trimmer head. Let hot parts cool first.",
      },
      {
        id: "t3-s2",
        title: "Adjust the H (high-speed) carburetor screw",
        costLabel: "$0",
        timeLabel: "2 mins",
        badge: "diy",
        letterCheck: true,
        body:
          STAMPED_LETTER_NOTE +
          " Find the H (high-speed) mixture screw. Hold full throttle in a clear, safe area for 2–3 seconds and turn H COUNTER-CLOCKWISE 1/8 turn until the bogging stops and the engine has a slight rich “burble” at peak RPM. A too-lean H screw can score the piston. " +
          LIMITER_NOTE,
        parts: ["carb-adjustment-tool"],
      },
      {
        id: "t3-s3",
        title: "Muffler spark-arrestor carbon blockage",
        costLabel: "$0",
        timeLabel: "5 mins",
        badge: "diy",
        body: "Remove and clean carbon off the muffler mesh screen, same as the acceleration-bog check.",
        safety: `${MUFFLER_HOT} ${TORCH_SAFETY}`,
        parts: ["spark-arrestor-screen"],
      },
      {
        id: "t3-s4",
        title: "Tank vent clogged (vacuum lock)",
        costLabel: "$8",
        timeLabel: "15 mins",
        badge: "part",
        body:
          "When it bogs, loosen the gas cap slightly. If power immediately returns, the tank vent valve is clogged and the tank is pulling a vacuum. Clean or replace the vent.",
        safety: "Loosen the cap slowly, outdoors, away from sparks. Fuel vapor will escape.",
        parts: ["tank-vent"],
      },
    ],
  },
  {
    id: "wont-start",
    title: "Won't start at all (zero pop, dead)",
    shortTitle: "Won't start at all",
    summary: "No fire, no pop. Cheap wet test first — then spark, then compression.",
    steps: [
      {
        id: "t4-s1",
        title: "The 1/2-teaspoon mix wet test",
        costLabel: "$0",
        timeLabel: "3 mins",
        badge: "diy",
        body:
          "Remove the air filter, pour 1/2 teaspoon of properly mixed 50:1 gas/oil directly into the carburetor throat, leave the choke OFF, and pull the cord 3 times.",
        safety: WET_TEST_FIRE,
        branch: {
          prompt: "What happened when you pulled the cord?",
          options: [
            {
              id: "fired",
              label: "It fired / ran for 2 seconds",
              action: {
                type: "end-diy",
                title: "Spark and compression are good — do not take this to a shop yet",
                body:
                  "A 2-second fire means the engine core can run. The problem is fuel delivery: clogged carb jets, a stiff metering diaphragm, a cracked fuel line, a bad in-tank filter, or a primer path issue. Work those cheap driveway fixes first (see the primer-bulb tree, the diaphragm step, and Fuel Mix for a fresh batch).",
                nextHint: "Open the primer-bulb / fuel-delivery tree next, or jump to My Garage to log this result.",
              },
            },
            {
              id: "zero-pop",
              label: "Zero pop at all",
              action: { type: "continue" },
            },
          ],
        },
      },
      {
        id: "t4-s2",
        title: "Spark plug & wire ground test",
        costLabel: "$4",
        timeLabel: "4 mins",
        badge: "diy",
        body:
          "Remove the spark plug, snap it into the rubber plug boot, hold the metal threads firmly against bare unpainted engine cylinder metal, and pull the cord briskly in the shade. Look for a bright blue spark. If there is NO spark: disconnect the kill-switch wire from the coil and retest (that rules out a shorted kill switch). Check the plug wire for cuts. Replace the spark plug before you replace the coil.",
        safety:
          "Hold the plug with insulated pliers, not your bare hand — a coil shock is unpleasant. Keep fuel and the wet-test area away from this spark. Work in shade so the spark is visible.",
        parts: ["spark-plug", "spark-plug-wire-boot", "ignition-coil"],
      },
      {
        id: "t4-s3",
        title: "Compression & cylinder scoring check",
        costLabel: "$0",
        timeLabel: "2 mins",
        badge: "shop",
        body:
          "Pull the starter cord slowly. If it spins with almost zero springy resistance, compression is likely gone. Remove the muffler (usually 2 bolts) and shine a flashlight at the piston skirt through the exhaust port. If vertical scratches or gouges are visible on the piston or cylinder wall, stop buying carb parts — this is internal damage.",
        safety: MUFFLER_HOT + " Disconnect the plug wire before you remove the muffler. The exhaust port has sharp edges.",
        parts: ["spark-arrestor-screen"],
        branch: {
          prompt: "What did you find?",
          options: [
            {
              id: "scored",
              label: "Deep vertical scratches, or almost no compression",
              action: {
                type: "end-diy",
                title: "Stop buying carb parts",
                body:
                  "A scored piston/cylinder or dead compression will not be fixed by a diaphragm kit or a tune. A shop rebuild often costs more than a replacement tool. Keep this one for spare parts or replace it. Confirm on the Shop Meter tab if you want the full four-question read.",
              },
            },
            {
              id: "healthy",
              label: "Strong springy compression and no deep scratches",
              action: {
                type: "end-diy",
                title: "The engine core looks healthy",
                body:
                  "You still have a no-start, but it is not a dead cylinder. Go back over spark (plug, boot, kill switch, coil) and fuel delivery (fresh mix, filter, lines, diaphragm, primer). Do not jump to a shop rebuild yet.",
              },
            },
            {
              id: "not-checked",
              label: "I have not pulled the muffler yet",
              action: { type: "continue" },
            },
          ],
        },
      },
    ],
  },
  {
    id: "primer-bulb",
    title: "Primer bulb stays empty, won't fill, or feels mushy",
    shortTitle: "Primer bulb problem",
    summary: "The bulb will not fill, will not stay firm, or feels like you are squeezing a dead balloon.",
    steps: [
      {
        id: "t5-s1",
        title: "Check fuel-line routing (suction vs. return)",
        costLabel: "$0",
        timeLabel: "2 mins",
        badge: "diy",
        body:
          "Verify the long line with the in-tank filter goes to the carb INLET nipple, and the short return line goes from the primer bulb back to the tank. Swapped lines prevent priming.",
      },
      {
        id: "t5-s2",
        title: "Cracked primer bulb",
        costLabel: "$4",
        timeLabel: "5 mins",
        badge: "diy",
        body:
          "Squeeze the bulb while listening for an air hiss. Tiny hairline cracks break vacuum. Snap in a new primer bulb (about $4).",
        parts: ["primer-bulb"],
      },
      {
        id: "t5-s3",
        title: "Split fuel line in the tank",
        costLabel: "$3",
        timeLabel: "5 mins",
        badge: "diy",
        body:
          "Pull the fuel lines up. Ethanol hardens and cracks lines right at the tank grommet. Replace the line.",
        safety: "Drain or work with a nearly empty tank outdoors, away from sparks. Wipe spills.",
        parts: ["tygon-fuel-line"],
      },
      {
        id: "t5-s4",
        title: "Stuck carburetor check valve / metering needle",
        costLabel: "$6",
        timeLabel: "10 mins",
        badge: "part",
        body:
          "Spray carb cleaner into the fuel inlet and check the metering lever height under the diaphragm. If the diaphragm is stiff or the needle is stuck, install a $6 diaphragm/gasket kit and set the lever flush with the body (or to the height in your carb’s manual).",
        safety:
          "Use carb cleaner outdoors or with strong ventilation. Wear eye protection. Keep spray away from sparks and the muffler if it is hot.",
        parts: ["carb-cleaner", "carb-diaphragm-kit"],
      },
    ],
  },
  {
    id: "spins-at-idle",
    title: "Chain or weed eater head keeps spinning at idle",
    shortTitle: "Spins at idle",
    summary: "The chain or string keeps moving after you let off the trigger. Fix idle first, clutch last.",
    steps: [
      {
        id: "t6-s1",
        title: "Lower the T / LA idle-speed screw",
        costLabel: "$0",
        timeLabel: "2 mins",
        badge: "diy",
        letterCheck: true,
        body:
          STAMPED_LETTER_NOTE +
          " Find the single larger idle-speed screw (T or LA) with a spring, resting against the throttle linkage. Turn COUNTER-CLOCKWISE 1/4 turn at a time until the chain or string stops completely at idle without stalling.",
        safety:
          "Keep hands, hair, and clothing away from the chain or head while you set idle. A saw should be on a flat surface with the chain brake handy.",
        parts: ["carb-adjustment-tool"],
      },
      {
        id: "t6-s2",
        title: "Fine-tune the L screw",
        costLabel: "$0",
        timeLabel: "2 mins",
        badge: "diy",
        letterCheck: true,
        body:
          STAMPED_LETTER_NOTE +
          " If the engine stalls when you lower the T/LA screw, turn the L (low-speed) screw 1/8 turn counter-clockwise for a smoother low-end idle, then re-set T/LA so the chain or head is stopped. " +
          LIMITER_NOTE,
        parts: ["carb-adjustment-tool"],
      },
      {
        id: "t6-s3",
        title: "Broken clutch spring",
        costLabel: "$15",
        timeLabel: "20 mins",
        badge: "part",
        body:
          "If the chain or head still spins violently even at a very low idle RPM, remove the clutch drum and inspect the wrap-around clutch spring. If it is broken or stretched, replace the spring (about $8–$15).",
        safety: CLUTCH_SAFETY,
        parts: ["clutch-spring"],
      },
    ],
  },
];

export { STAMPED_LETTER_NOTE, LIMITER_NOTE };
export const LETTER_CHECK_NOTE = STAMPED_LETTER_NOTE;
export const LIMITER_NOTE_TEXT = LIMITER_NOTE;
export const DISCLAIMER =
  "CrankIt is general guidance for common 2-stroke outdoor tools, not a substitute for your manufacturer’s manual, a shop manual, or a qualified mechanic. Procedures, screw baselines, plug gaps, and torque values vary by model. Follow the manual for your exact tool, use eye and hand protection, and stop if a step is beyond your comfort or tools.";

export function treeById(id: string): DiagTree | undefined {
  return TREES.find((t) => t.id === id);
}

export function allStepCount(): number {
  return TREES.reduce((n, t) => n + t.steps.length, 0);
}
