import EnrichmentImport from "./EnrichmentImport";
import type { Race } from "./race";
export default function LocationImport({
  raceId,
  onLoaded,
}: {
  raceId: string;
  onLoaded: (race: Race) => void;
}) {
  return (
    <EnrichmentImport raceId={raceId} kind="locations" onLoaded={onLoaded} />
  );
}
