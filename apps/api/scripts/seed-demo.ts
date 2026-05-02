/**
 * Seed a handful of demo hazards around Parks Library / Hoover / Marston
 * so the pitch has something visible on first launch.
 *
 *   pnpm --filter api seed
 */
import { supabase } from "../src/lib/supabase";

type DemoHazard = {
  building_id: string | null;
  floor_id: string | null;
  latitude: number | null;
  longitude: number | null;
  indoor_x: number | null;
  indoor_y: number | null;
  type: string;
  severity: string;
  description: string;
};

const demo: DemoHazard[] = [
  {
    building_id: "parks-library",
    floor_id: "1",
    latitude: null,
    longitude: null,
    indoor_x: 55,
    indoor_y: 52,
    type: "blocked_path",
    severity: "medium",
    description: "Stack of chairs near the north stairwell making the hallway narrow.",
  },
  {
    building_id: "parks-library",
    floor_id: "2",
    latitude: null,
    longitude: null,
    indoor_x: 67,
    indoor_y: 48,
    type: "broken_door_button",
    severity: "high",
    description: "Accessible restroom door button unresponsive on floor 2.",
  },
  {
    building_id: null,
    floor_id: null,
    latitude: 42.0268,
    longitude: -93.6482,
    indoor_x: null,
    indoor_y: null,
    type: "construction",
    severity: "high",
    description: "Sidewalk closure between SIC and Parks — detour signs posted.",
  },
  {
    building_id: null,
    floor_id: null,
    latitude: 42.0275,
    longitude: -93.6498,
    indoor_x: null,
    indoor_y: null,
    type: "icy_sidewalk",
    severity: "critical",
    description: "Ice patch near Marston entrance reported this morning.",
  },
  {
    building_id: "hoover",
    floor_id: "1",
    latitude: null,
    longitude: null,
    indoor_x: 50,
    indoor_y: 50,
    type: "broken_elevator",
    severity: "critical",
    description: "Hoover east elevator out of service. Use Durham elevator as detour.",
  },
  {
    building_id: null,
    floor_id: null,
    latitude: 42.0266,
    longitude: -93.6465,
    indoor_x: null,
    indoor_y: null,
    type: "crowded_area",
    severity: "low",
    description: "Large event crowd forming outside Memorial Union plaza.",
  },
];

async function main() {
  const deviceId = "demo-seed-device";
  for (const row of demo) {
    const { error } = await supabase.from("hazards").insert({
      ...row,
      status: "active",
      created_by_device_id: deviceId,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("insert failed:", error.message);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${demo.length} demo hazards.`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
